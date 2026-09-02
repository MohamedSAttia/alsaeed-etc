import http from 'http';
import { spawn } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_PORT = Number(process.env.PORT || 3000);
const INTERNAL_PORT = Number(process.env.INTERNAL_APP_PORT || 3001);
const SITE = String(process.env.SITE_URL || 'https://al-ltc.com').replace(/\/$/, '');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'alsaeed.db');
const JWT_SECRET = process.env.JWT_SECRET || '';
const PAYMENT_GATEWAY = String(process.env.PAYMENT_GATEWAY || 'kashier').toLowerCase();

// Run the existing application on an internal port. The public proxy keeps the
// existing app unchanged, adjusts Referrer-Policy for Vimeo, and owns the
// Kashier checkout endpoints so payment credentials remain server-side.
const child = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(INTERNAL_PORT) },
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  console.error(`Application process exited (code=${code}, signal=${signal || 'none'})`);
  process.exit(code ?? 1);
});

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade'
]);

const setting = key => {
  try {
    const row = db.prepare('SELECT v FROM settings WHERE k=?').get(key);
    return row ? row.v : '';
  } catch {
    return '';
  }
};

function uid() {
  return crypto.randomBytes(9).toString('base64url');
}

function sendJson(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store'
  });
  res.end(data);
}

async function readJson(req, limit = 1024 * 1024) {
  return await new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('request too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function authenticatedUser(req) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET غير مضبوط على الخادم');
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    return db.prepare('SELECT id,name,email,phone,role,active FROM users WHERE id=?').get(payload.id) || null;
  } catch {
    return null;
  }
}

function kashierConfig() {
  return {
    mid: String(process.env.KASHIER_MERCHANT_ID || '').trim(),
    paymentKey: String(process.env.KASHIER_PAYMENT_API_KEY || '').trim(),
    mode: String(process.env.KASHIER_MODE || 'test').trim().toLowerCase() === 'live' ? 'live' : 'test',
    allowedMethods: String(process.env.KASHIER_ALLOWED_METHODS || 'card,wallet').trim(),
    baseUrl: 'https://checkout.kashier.io/'
  };
}

function kashierOrderHash(mid, orderId, amount, currency, paymentKey) {
  const pathToSign = `/?payment=${mid}.${orderId}.${amount}.${currency}`;
  return crypto.createHmac('sha256', paymentKey).update(pathToSign).digest('hex');
}

function kashierCallbackPayload(q) {
  return [
    ['paymentStatus', q.paymentStatus],
    ['cardDataToken', q.cardDataToken],
    ['maskedCard', q.maskedCard],
    ['merchantOrderId', q.merchantOrderId],
    ['orderId', q.orderId],
    ['cardBrand', q.cardBrand],
    ['orderReference', q.orderReference],
    ['transactionId', q.transactionId],
    ['amount', q.amount],
    ['currency', q.currency]
  ].map(([key, value]) => `${key}=${value ?? ''}`).join('&');
}

function validKashierSignature(q, paymentKey) {
  const supplied = String(q.signature || '').toLowerCase();
  if (!supplied || !/^[a-f0-9]{64}$/.test(supplied)) return false;
  const expected = crypto.createHmac('sha256', paymentKey)
    .update(kashierCallbackPayload(q))
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'));
  } catch {
    return false;
  }
}

function grant(userId, pkgId, days, source) {
  const expires = days ? Date.now() + Number(days) * 86400000 : null;
  db.prepare(`INSERT INTO enrollments (id,user_id,package_id,source,expires,created)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(user_id,package_id) DO UPDATE SET expires=?, source=?`)
    .run(uid(), userId, pkgId, source || 'Kashier', expires, Date.now(), expires, source || 'Kashier');
}

function markOrderPaid(order) {
  if (!order || order.status === 'paid') return;
  let catalog = [];
  try { catalog = JSON.parse(setting('catalog') || '[]'); } catch {}
  const pkg = catalog.find(p => p.id === order.package_id) || {};
  const tx = db.transaction(() => {
    const current = db.prepare('SELECT status FROM orders WHERE id=?').get(order.id);
    if (!current || current.status === 'paid') return;
    db.prepare("UPDATE orders SET status='paid', paid_at=? WHERE id=?").run(Date.now(), order.id);
    grant(order.user_id, order.package_id, pkg.days || 90, 'Kashier');
  });
  tx();
}

async function handleKashierCreate(req, res) {
  const cfg = kashierConfig();
  if (!cfg.mid || !cfg.paymentKey) {
    return sendJson(res, 503, {
      error: 'بوابة Kashier لم تكتمل بعد. أضف KASHIER_MERCHANT_ID و KASHIER_PAYMENT_API_KEY في Railway.'
    });
  }

  const user = authenticatedUser(req);
  if (!user) return sendJson(res, 401, { error: 'يلزم تسجيل الدخول' });
  if (user.active === 0) return sendJson(res, 403, { error: 'هذا الحساب معطّل' });

  let body;
  try { body = await readJson(req); }
  catch { return sendJson(res, 400, { error: 'بيانات الطلب غير صحيحة' }); }

  const packageId = String(body.packageId || '').trim();
  let catalog = [];
  try { catalog = JSON.parse(setting('catalog') || '[]'); } catch {}
  const pkg = catalog.find(p => p.id === packageId);
  if (!pkg) return sendJson(res, 404, { error: 'الباقة غير موجودة' });

  const enrolled = db.prepare('SELECT id FROM enrollments WHERE user_id=? AND package_id=?')
    .get(user.id, packageId);
  if (enrolled) return sendJson(res, 409, { error: 'أنت مشترك في هذه الباقة' });

  const numericAmount = Number(pkg.price);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return sendJson(res, 400, { error: 'سعر الباقة غير صالح للدفع الإلكتروني' });
  }

  const amount = numericAmount.toFixed(2);
  const currency = String(pkg.currency || 'USD').toUpperCase();
  const orderId = 'ORD-' + uid().toUpperCase();

  db.prepare(`INSERT INTO orders (id,user_id,package_id,amount,currency,status,gateway,gateway_id,created)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(orderId, user.id, packageId, numericAmount, currency, 'pending', 'kashier', orderId, Date.now());

  const hash = kashierOrderHash(cfg.mid, orderId, amount, currency, cfg.paymentKey);
  const params = new URLSearchParams({
    merchantId: cfg.mid,
    orderId,
    amount,
    currency,
    hash,
    merchantRedirect: `${SITE}/api/pay/kashier/return/${encodeURIComponent(orderId)}`,
    metaData: JSON.stringify({
      customerName: user.name || '',
      customerEmail: user.email || '',
      customerPhone: user.phone || '',
      packageId
    }),
    allowedMethods: cfg.allowedMethods,
    failureRedirect: 'true',
    redirectMethod: 'get',
    display: 'ar',
    brandColor: 'rgba(240, 116, 26, 1)',
    mode: cfg.mode
  });

  return sendJson(res, 200, {
    orderId,
    paymentUrl: `${cfg.baseUrl}?${params.toString()}`,
    gateway: 'kashier',
    mode: cfg.mode
  });
}

function handleKashierReturn(req, res, requestUrl) {
  const cfg = kashierConfig();
  const match = requestUrl.pathname.match(/^\/api\/pay\/kashier\/return\/([^/]+)$/);
  const orderId = match ? decodeURIComponent(match[1]) : '';
  const q = Object.fromEntries(requestUrl.searchParams.entries());
  const order = orderId ? db.prepare('SELECT * FROM orders WHERE id=?').get(orderId) : null;

  let paid = false;
  let reason = 'invalid';
  if (order && cfg.paymentKey && validKashierSignature(q, cfg.paymentKey)) {
    const sameOrder = String(q.merchantOrderId || '') === String(order.id);
    const sameCurrency = String(q.currency || '').toUpperCase() === String(order.currency || '').toUpperCase();
    const sameAmount = Math.abs(Number(q.amount) - Number(order.amount)) < 0.001;
    const status = String(q.paymentStatus || '').toUpperCase();
    const successful = ['SUCCESS', 'PAID', 'CAPTURED'].includes(status);

    if (sameOrder && sameCurrency && sameAmount && successful) {
      markOrderPaid(order);
      paid = true;
      reason = 'paid';
    } else if (!successful) {
      reason = 'not-paid';
    } else {
      reason = 'mismatch';
    }
  } else if (order && order.status === 'paid') {
    paid = true;
    reason = 'already-paid';
  }

  const pkgId = order ? order.package_id : '';
  res.writeHead(302, {
    location: `${SITE}/#learn/${encodeURIComponent(pkgId)}?paid=${paid ? '1' : '0'}&gateway=kashier&reason=${encodeURIComponent(reason)}`,
    'cache-control': 'no-store'
  });
  res.end();
}

function forwardToApp(req, res) {
  const headers = { ...req.headers };
  delete headers.connection;
  headers.host = req.headers.host || 'al-ltc.com';
  headers['x-forwarded-proto'] = req.headers['x-forwarded-proto'] || 'https';
  headers['x-forwarded-host'] = req.headers.host || '';

  const upstream = http.request({
    hostname: '127.0.0.1',
    port: INTERNAL_PORT,
    method: req.method,
    path: req.url,
    headers
  }, upstreamRes => {
    const outHeaders = {};
    for (const [key, value] of Object.entries(upstreamRes.headers)) {
      if (!HOP_BY_HOP.has(key.toLowerCase()) && value !== undefined) outHeaders[key] = value;
    }

    // Vimeo domain-restricted embeds need the embedding origin in Referer.
    // This sends only the origin cross-site, not the path/query.
    outHeaders['referrer-policy'] = 'strict-origin-when-cross-origin';

    res.writeHead(upstreamRes.statusCode || 502, outHeaders);
    upstreamRes.pipe(res);
  });

  upstream.on('error', err => {
    console.error('Proxy upstream error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    }
    res.end(JSON.stringify({ error: 'Temporary upstream error' }));
  });

  req.pipe(upstream);
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  try {
    if (PAYMENT_GATEWAY === 'kashier' && req.method === 'POST' && requestUrl.pathname === '/api/pay/create') {
      return await handleKashierCreate(req, res);
    }

    if (PAYMENT_GATEWAY === 'kashier' && req.method === 'GET' && requestUrl.pathname.startsWith('/api/pay/kashier/return/')) {
      return handleKashierReturn(req, res, requestUrl);
    }

    return forwardToApp(req, res);
  } catch (err) {
    console.error('Proxy request error:', err);
    if (!res.headersSent) sendJson(res, 500, { error: 'حدث خطأ بالخادم أثناء تنفيذ العملية' });
    else res.end();
  }
});

server.listen(PUBLIC_PORT, '0.0.0.0', () => {
  console.log(`Public proxy listening on ${PUBLIC_PORT}; app on ${INTERNAL_PORT}; payments=${PAYMENT_GATEWAY}`);
});
