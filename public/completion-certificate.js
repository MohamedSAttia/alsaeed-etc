/* AlSaeed completion certificate. Presentation only; issuance and eligibility stay on the server. */
(function (root) {
  'use strict';
  const WIDTH = 1400, HEIGHT = 1092, PRINT_SCALE = 280 / (1400 * 25.4 / 96);
  const brandMark = size => typeof root.LOGO === 'function' ? root.LOGO(size).replace(/fill="url\(#([^"]+)\)"/g, (_, id) => `fill="${id.endsWith('o')?'#ed8325':'#12395b'}"`) : '';
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function record(input) {
    const issued = Number(input.issued);
    if (!String(input.name || '').trim() || !String(input.no || '').trim() || !String(input.course || '').trim() || !Number.isFinite(issued) || issued <= 0 || Number.isNaN(new Date(issued).valueOf())) {
      throw new Error('The issued certificate record is incomplete.');
    }
    const hours = Number(input.hours);
    return {...input, issued, hours: Number.isFinite(hours) && hours > 0 ? hours : null};
  }

  const PMP_TITLE = 'Project Management Professional (PMP)® Preparation Course';
  const BADGE_ASSETS = Object.freeze({
    pmp: ['/assets/badges/pmi-atp-instructor-pmp.png', '/assets/badges/pmi-atp-instructor-pmp-supplied.png'],
    rmp: ['/assets/badges/pmi-atp-instructor-rmp.png']
  });
  // An issuance snapshot is the only source of instructor and course branding.
  function presentation(data) {
    const snapshot = data.presentation;
    if (!snapshot || snapshot.version !== 1 || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
    return snapshot;
  }
  function assetUrl(value, origin, kind) {
    if (typeof value !== 'string' || !value || value.length > 512 || /[\s\\?#%<>"']/.test(value)) return '';
    try {
      const url = new URL(value, origin);
      if (url.origin !== origin || url.username || url.password || url.search || url.hash) return '';
      const valid = kind === 'course'
        ? /^\/assets\/(?:certifications|covers)\/[a-z0-9_-]+\.(?:png|jpe?g|webp|svg)$/i.test(url.pathname)
        : kind === 'signature'
          ? /^\/assets\/signatures\/[a-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(url.pathname)
          : Object.values(BADGE_ASSETS).some(paths => paths.includes(url.pathname));
      return valid ? url.href : '';
    } catch { return ''; }
  }
  function verificationUrl(value, origin) {
    if (typeof value !== 'string' || /[\s\\?#%<>"']/.test(value)) return '';
    try {
      const url = new URL(value, origin);
      return url.origin === origin && !url.username && !url.password && /^\/verify\/[A-Za-z0-9_-]{1,128}$/.test(url.pathname) ? url.href : '';
    } catch { return ''; }
  }
  function qrSource(value, verification) {
    // Accept only the server-generated PNG. No remote QR service or SVG payload.
    return verification && typeof value === 'string' && value.length <= 100000 && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
  }
  function instructorPresentation(snapshot, origin) {
    const instructor = snapshot?.instructor;
    if (!instructor || typeof instructor !== 'object' || Array.isArray(instructor) || !String(instructor.id || '').trim() || !String(instructor.name || '').trim()) return null;
    const badge = instructor.badge;
    const badgeAsset = badge?.verified === true && badge.courseId === snapshot.courseId && BADGE_ASSETS[snapshot.courseId]?.includes(badge.asset)
      ? assetUrl(badge.asset, origin, 'badge') : '';
    return {name: String(instructor.name), title: String(instructor.title || 'Course Instructor'),
      signatureAsset: assetUrl(instructor.signatureAsset, origin, 'signature'),
      badgeAsset, badgeLabel: badgeAsset ? String(badge.label || 'Instructor credential') : ''};
  }
  function seal() {
    const points = Array.from({length:96}, (_, i) => {
      const angle = i * Math.PI / 48, radius = i % 2 ? 90 : 98;
      return `${(100 + radius * Math.cos(angle)).toFixed(2)},${(100 + radius * Math.sin(angle)).toFixed(2)}`;
    }).join(' ');
    const mark = brandMark(66);
    return `<svg class="gold-seal" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AlSaeed training completion seal"><defs><radialGradient id="completion-gold"><stop stop-color="#fff4c7"/><stop offset=".52" stop-color="#e4bf58"/><stop offset=".84" stop-color="#b67d1e"/><stop offset="1" stop-color="#efd584"/></radialGradient></defs><polygon points="${points}" fill="url(#completion-gold) #dbb75c" stroke="#9b6813"/><circle cx="100" cy="100" r="85" fill="none" stroke="#fff0b5" stroke-width="3"/><circle cx="100" cy="100" r="79" fill="none" stroke="#a7731b" stroke-width="1.6"/><text x="100" y="48" text-anchor="middle" font-family="Georgia,serif" font-weight="bold" font-size="17" letter-spacing="2" fill="#694710">ALSAEED</text><g transform="translate(67 57)">${mark}</g><text x="100" y="142" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="12" letter-spacing="1.2" fill="#694710">TRAINING</text><text x="100" y="157" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="12" letter-spacing=".8" fill="#694710">COMPLETION</text><text x="100" y="176" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" fill="#8b5e13">★ ★ ★ ★ ★</text></svg>`;
  }
  function initialSize(text, maximum, minimum, width, height, lineHeight) {
    let size=maximum;
    const units=Array.from(String(text)).reduce((sum,c)=>sum+(/[WM]/.test(c)?1.1:/[ilI .'-]/.test(c)?.4:/[A-Z]/.test(c)?.85:/[a-z0-9]/.test(c)?.65:1.1),0);
    while(size>minimum && (Math.ceil(units*size/width)>2 || Math.ceil(units*size/width)*size*lineHeight>height))size--;
    return size;
  }

  function render(input) {
    const data = record(input), snapshot = presentation(data);
    const courseId = snapshot ? snapshot.courseId : data.presentation == null ? data.courseId : '';
    const isPmp = courseId === 'pmp';
    // Legacy titles retain the exact-PMP display rule, but receive no new credentials.
    const courseTitle = isPmp ? PMP_TITLE : data.course;
    const courseHtml = isPmp ? 'Project Management Professional (PMP)<sup class="cert-trademark">®</sup> Preparation Course' : escape(courseTitle);
    const nameSize = initialSize(data.name,66,18,1114,92,1.08);
    const courseSize = initialSize(courseTitle,36,12,1174,73,1.16);
    const origin = new URL(root.location.origin).origin, logo = brandMark(132);
    const instructor = instructorPresentation(snapshot, origin);
    const courseLogo = snapshot ? assetUrl(snapshot.courseLogo, origin, 'course') : '';
    const verification = verificationUrl(data.verify, origin), qr = qrSource(data.qr, verification);
    const instructorName = instructor?.name || 'Name not recorded';
    const instructorSize = initialSize(instructorName,24,8,instructor?.badgeAsset ? 300 : 405,56,1.16);
    const instructorTitleSize = initialSize(instructor?.title || '',14,8,instructor?.badgeAsset ? 300 : 405,28,1.2);
    const issueDate = new Intl.DateTimeFormat('en-GB', {day:'2-digit', month:'long', year:'numeric', timeZone:'UTC'}).format(new Date(data.issued));
    const signatureHtml = instructor?.signatureAsset
      ? `<img class="cert-signature-image" src="${escape(instructor.signatureAsset)}" alt="Instructor signature">`
      : '<span class="cert-signature-slot">Instructor signature</span>';
    const instructorHtml = `<div class="cert-instructor-summary">${instructor?.badgeAsset ? `<img class="cert-instructor-badge" src="${escape(instructor.badgeAsset)}" alt="${escape(instructor.badgeLabel)}">` : ''}<div class="cert-instructor-details"><small class="cert-instructor-label">Instructor</small><b class="cert-instructor-name"><span dir="auto">${escape(instructorName)}</span></b>${instructor?.title && instructor.title !== 'Instructor' && instructor.title !== 'Course Instructor' ? `<small class="cert-instructor-title" dir="auto"><span>${escape(instructor.title)}</span></small>` : ''}</div></div>`;
    const html = `<!DOCTYPE html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AlSaeed completion certificate · ${escape(data.no)}</title><style>
*{box-sizing:border-box}html,body{margin:0;padding:0}body{background:#e7edf2;color:#092c49;font-family:Georgia,'Times New Roman',serif}
.cert-viewport{position:relative;width:min(100%,1400px);height:1092px;margin:0 auto;overflow:hidden}
.cert-canvas{position:absolute;left:50%;margin-left:-700px;top:0;width:1400px;height:1092px;background:#0b304e;transform:scale(var(--certificate-scale,1));transform-origin:center top}
.cert-paper{position:absolute;inset:44px;background:linear-gradient(125deg,#fffefa,#fffefb 60%,#fcfaf4);border:3px solid #bd8e29;outline:1px solid #f0dc9d;outline-offset:-8px;text-align:center}
.cert-brand{position:absolute;top:28px;left:180px;right:180px}.cert-brand svg{display:block;margin:0 auto;width:132px;height:125px}.cert-brand strong{display:block;margin:2px 0 7px;font-family:Arial,sans-serif;font-size:38px;letter-spacing:6px}.cert-brand span{display:block;font-size:14px;letter-spacing:2.3px;color:#465e77}
.cert-course-brand{position:absolute;right:38px;top:37px;width:168px;text-align:center}.cert-course-logo{display:block;width:168px;height:151px;object-fit:contain}.cert-course-brand small{display:block;margin-top:8px;font:11px Arial,sans-serif;letter-spacing:1.7px;color:#62738a}
.cert-title{position:absolute;top:232px;left:35px;right:35px;margin:0;font-size:86px;font-weight:bold;line-height:1.12;letter-spacing:1px}.cert-subtitle{position:absolute;top:329px;left:35px;right:35px;font-size:37px;line-height:1;letter-spacing:13px}
.cert-award{position:absolute;top:395px;left:45px;right:45px;margin:0;color:#4b6178;font-size:31px;line-height:1.3}
.cert-name{position:absolute;top:442px;left:95px;right:95px;height:92px;display:flex;align-items:center;justify-content:center;font-size:${nameSize}px;font-weight:bold;line-height:1.08;overflow-wrap:anywhere}.cert-name span{max-width:100%}
.cert-rule{position:absolute;top:536px;left:135px;right:135px;border:0;border-top:2px solid #b58a2b;margin:0}
.cert-completed{position:absolute;top:557px;left:50px;right:50px;margin:0;color:#4b6178;font-size:30px;line-height:1.25}
.cert-course{position:absolute;top:602px;left:65px;right:65px;height:73px;margin:0;display:flex;align-items:center;justify-content:center;font-size:${courseSize}px;font-weight:bold;line-height:1.16;overflow-wrap:anywhere}.cert-course span{max-width:100%}.cert-trademark{position:relative;top:-.55em;font-size:.52em;line-height:0;vertical-align:baseline}
.cert-hours{position:absolute;top:680px;left:100px;right:100px;margin:0;font-size:27px;line-height:1.2}
.cert-signature{position:absolute;top:735px;text-align:center}.cert-signature.left{left:65px;width:425px}.cert-signature.right{right:220px;width:300px}.cert-signature-image{display:block;margin:0 auto;max-width:100%;width:340px;height:65px;object-fit:contain}.cert-signature-slot,.cert-issuer-mark{height:65px;display:flex;align-items:end;justify-content:center;padding-bottom:12px;color:#8897a6;font:18px Arial,sans-serif;letter-spacing:1px}.cert-issuer-mark{color:#0d3c66;font-family:Georgia,serif;font-size:34px;letter-spacing:3px}
.cert-signature-line{border:0;border-top:2px solid #b58a2b;margin:4px 0 8px}.cert-signature b{display:block;font-size:21px;line-height:1.25}.cert-signature small{display:block;font-size:16px;line-height:1.25;color:#4b6178}
.cert-instructor-summary{display:flex;align-items:center;justify-content:center;gap:14px;height:108px}.cert-instructor-badge{width:90px;height:90px;object-fit:contain;flex:none}.cert-instructor-details{min-width:0;flex:1}.cert-signature .cert-instructor-label{font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:1.5px;font-size:12px;margin:0 0 3px}.cert-signature .cert-instructor-name{display:flex;align-items:center;justify-content:center;font-size:${instructorSize}px;line-height:1.16;height:56px;overflow-wrap:anywhere}.cert-instructor-name span{max-width:100%}.cert-signature .cert-instructor-title{display:flex;align-items:center;justify-content:center;margin-top:3px;font-size:${instructorTitleSize}px;line-height:1.2;height:28px;overflow-wrap:anywhere}.cert-instructor-title span{max-width:100%}
.cert-seal{position:absolute;top:737px;left:50%;margin-left:-111px;width:178px;height:178px}.gold-seal{width:100%;height:100%}
.cert-record{position:absolute;left:65px;right:220px;bottom:37px;display:flex;justify-content:center;align-items:center;gap:26px;color:#425d77;font-size:17px;line-height:1.3}.cert-record .divider{height:23px;width:2px;background:#b58a2b}.cert-record b{font-weight:normal;color:#183a56}
.cert-verify{position:absolute;left:65px;right:220px;bottom:14px;margin:0;font-family:Arial,sans-serif;font-size:10px;line-height:1.2;color:#62738a;overflow-wrap:anywhere}.cert-verify a{color:inherit;text-decoration:none}
.cert-qr{position:absolute;right:36px;bottom:21px;width:142px;padding:7px 7px 8px;border:1px solid #b58a2b;border-radius:7px;background:#fff;color:#183a56;text-decoration:none}.cert-qr img{display:block;width:126px;height:126px;object-fit:contain;background:#fff}.cert-qr span{display:block;margin-top:3px;font:12px Arial,sans-serif;letter-spacing:.3px}
@page{size:280mm 218.4mm;margin:0}@media print{html,body{width:280mm;height:218.4mm;background:white}.cert-viewport{width:280mm!important;height:218.4mm!important;max-width:none;margin:0}.cert-canvas{transform:scale(.7559055118)!important}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><main class="cert-viewport" aria-label="Issued training completion certificate"><article class="cert-canvas"><div class="cert-paper">
<div class="cert-brand">${logo}<strong>ALSAEED</strong><span>EDUCATION · TRAINING · CONSULTING</span></div>
${courseLogo ? `<div class="cert-course-brand"><img class="cert-course-logo" src="${escape(courseLogo)}" alt="${escape(snapshot.courseCode || courseTitle)} course logo"><small>PROGRAM</small></div>` : ''}
<h1 class="cert-title">CERTIFICATE</h1><div class="cert-subtitle">OF COMPLETION</div><p class="cert-award">This certificate is awarded to</p>
<div class="cert-name"><span dir="auto">${escape(data.name)}</span></div><hr class="cert-rule"><p class="cert-completed">for successfully completing the training program</p>
<h2 class="cert-course"><span dir="auto">${courseHtml}</span></h2><p class="cert-hours">${data.hours ? `${escape(data.hours)} Training Hours` : ''}</p>
<div class="cert-signature left">${signatureHtml}<hr class="cert-signature-line">${instructorHtml}</div><div class="cert-seal">${seal()}</div>
<div class="cert-signature right"><span class="cert-issuer-mark">ALSAEED</span><hr class="cert-signature-line"><b>Alsaeed Education, Training &amp; Consulting</b></div>
<div class="cert-record"><span>Certificate No.: <b>${escape(data.no)}</b></span><span class="divider" aria-hidden="true"></span><span>Date of Issue: <b>${escape(issueDate)}</b></span></div>
${qr ? `<a class="cert-qr" href="${escape(verification)}" aria-label="Verify this certificate"><img src="${qr}" alt="QR code for certificate verification"><span>Scan to verify</span></a>` : ''}
${verification ? `<p class="cert-verify">Verification: <a href="${escape(verification)}">${escape(verification)}</a></p>` : ''}
</div></article></main></body></html>`;
    // Scale actual print boxes to avoid fragmented pages or cropped transformed content.
    return html.replace(/<style>([\s\S]*?)<\/style>/, (_, css) => {
      const printCss = css.split('@page')[0].replace(/(-?\d+(?:\.\d+)?)px\b/g, (_, value) => (Number(value)*PRINT_SCALE).toFixed(5)+'px');
      return `<style>${css}\n@media print{${printCss}html,body,.cert-viewport{width:280mm!important;height:218.4mm!important}.cert-viewport{margin:0}.cert-canvas{position:relative;left:0;margin-left:0;transform:none!important}.cert-name{font-size:var(--certificate-name-print-size,${nameSize*PRINT_SCALE}px)!important}.cert-course{font-size:var(--certificate-course-print-size,${courseSize*PRINT_SCALE}px)!important}.cert-instructor-name{font-size:var(--certificate-instructor-print-size,${instructorSize*PRINT_SCALE}px)!important}.cert-instructor-title{font-size:var(--certificate-instructor-title-print-size,${instructorTitleSize*PRINT_SCALE}px)!important}}</style>`;
    });
  }
  async function prepare(popup) {
    const doc = popup.document;
    await Promise.all([doc.fonts?.ready || Promise.resolve(), ...Array.from(doc.images).map(img => img.complete ? Promise.resolve() : new Promise(resolve => {img.onload=resolve;img.onerror=resolve;}))]);
    for (const [selector, variable, minimum] of [['.cert-name','--certificate-name-print-size',18],['.cert-course','--certificate-course-print-size',12],['.cert-instructor-name','--certificate-instructor-print-size',8],['.cert-instructor-title','--certificate-instructor-title-print-size',8]]) {
      const box = doc.querySelector(selector), text = box?.firstElementChild;
      if (!box || !text || !box.clientWidth) continue;
      let size = parseFloat(popup.getComputedStyle(box).fontSize);
      while (size > minimum && (text.scrollWidth > box.clientWidth || text.scrollHeight > box.clientHeight)) { size -= 1; box.style.fontSize = size+'px'; }
      box.style.setProperty(variable, (size*PRINT_SCALE)+'px');
    }
    const resize = () => {
      const scale = Math.min(1,popup.innerWidth/WIDTH);
      doc.querySelector('.cert-canvas').style.setProperty('--certificate-scale',String(scale));
      doc.querySelector('.cert-viewport').style.height = (HEIGHT*scale)+'px';
    };
    resize(); popup.addEventListener('resize',resize);
  }
  root.AlsaeedCertificate = Object.freeze({render,prepare,record,width:WIDTH,height:HEIGHT});
})(window);
