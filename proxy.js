import http from 'http';
import { spawn } from 'child_process';

const PUBLIC_PORT = Number(process.env.PORT || 3000);
const INTERNAL_PORT = Number(process.env.INTERNAL_APP_PORT || 3001);

// Run the existing application on an internal port. The public proxy below
// only adjusts the Referrer-Policy response header so domain-restricted Vimeo
// embeds can see the embedding origin (e.g. https://al-ltc.com).
const child = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(INTERNAL_PORT) },
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  console.error(`Application process exited (code=${code}, signal=${signal || 'none'})`);
  process.exit(code ?? 1);
});

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade'
]);

const server = http.createServer((req, res) => {
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

    // Helmet defaults to "no-referrer". Vimeo's domain-level embed privacy
    // needs the embedding origin in the Referer header, so allow only the
    // origin to be sent cross-site (no paths, queries, or sensitive details).
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
});

server.listen(PUBLIC_PORT, '0.0.0.0', () => {
  console.log(`Public proxy listening on ${PUBLIC_PORT}; app on ${INTERNAL_PORT}`);
});
