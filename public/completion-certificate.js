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
    const data = record(input), isPmp = data.courseId === 'pmp';
    const nameSize=initialSize(data.name,66,18,1114,92,1.08), courseSize=initialSize(data.course,36,18,1174,73,1.16);
    const origin = new URL(root.location.origin).origin;
    const logo = brandMark(132);
    const issueDate = new Intl.DateTimeFormat('en-GB', {day:'2-digit', month:'long', year:'numeric', timeZone:'UTC'}).format(new Date(data.issued));
    let verification = '';
    try { const url = new URL(data.verify, origin); if (url.origin === origin && url.pathname.startsWith('/verify/')) verification = url.href; } catch {}
    const html = `<!DOCTYPE html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AlSaeed completion certificate · ${escape(data.no)}</title><style>
@font-face{font-family:AlSaeedSignature;src:url('${origin}/assets/fonts/Allura-Regular.ttf') format('truetype');font-display:swap}
*{box-sizing:border-box}html,body{margin:0;padding:0}body{background:#e7edf2;color:#092c49;font-family:Georgia,'Times New Roman',serif}.cert-viewport{position:relative;width:min(100%,1400px);height:1092px;margin:0 auto;overflow:hidden}.cert-canvas{position:absolute;left:50%;margin-left:-700px;top:0;width:1400px;height:1092px;background:#0b304e;transform:scale(var(--certificate-scale,1));transform-origin:center top}.cert-paper{position:absolute;inset:44px;background:linear-gradient(125deg,#fffefa,#fffefb 60%,#fcfaf4);border:3px solid #bd8e29;outline:1px solid #f0dc9d;outline-offset:-8px;text-align:center}.cert-brand{position:absolute;top:28px;left:180px;right:180px}.cert-brand svg{display:block;margin:0 auto;width:132px;height:125px}.cert-brand strong{display:block;margin:2px 0 7px;font-family:Arial,sans-serif;font-size:38px;letter-spacing:6px}.cert-brand span{display:block;font-size:14px;letter-spacing:2.3px;color:#465e77}.cert-badge{position:absolute;right:35px;top:33px;width:169px;height:169px;object-fit:contain}.cert-title{position:absolute;top:232px;left:35px;right:35px;margin:0;font-size:86px;font-weight:bold;line-height:1.12;letter-spacing:1px}.cert-subtitle{position:absolute;top:329px;left:35px;right:35px;font-size:37px;line-height:1;letter-spacing:13px}.cert-award{position:absolute;top:395px;left:45px;right:45px;margin:0;color:#4b6178;font-size:31px;line-height:1.3}.cert-name{position:absolute;top:442px;left:95px;right:95px;height:92px;display:flex;align-items:center;justify-content:center;font-size:${nameSize}px;font-weight:bold;line-height:1.08;overflow-wrap:anywhere}.cert-name span{max-width:100%}.cert-rule{position:absolute;top:536px;left:135px;right:135px;border:0;border-top:2px solid #b58a2b;margin:0}.cert-completed{position:absolute;top:557px;left:50px;right:50px;margin:0;color:#4b6178;font-size:30px;line-height:1.25}.cert-course{position:absolute;top:602px;left:65px;right:65px;height:73px;margin:0;display:flex;align-items:center;justify-content:center;font-size:${courseSize}px;font-weight:bold;line-height:1.16;overflow-wrap:anywhere}.cert-course span{max-width:100%}.cert-hours{position:absolute;top:680px;left:100px;right:100px;margin:0;font-size:27px;line-height:1.2}.cert-signature{position:absolute;top:775px;width:385px;text-align:center}.cert-signature.left{left:73px}.cert-signature.right{right:73px}.cert-script{font-family:AlSaeedSignature,'Brush Script MT',cursive;font-size:65px;line-height:1.05;white-space:nowrap;color:#0d3c66;display:block;height:73px}.cert-signature.right .cert-script{font-size:69px}.cert-signature-line{border:0;border-top:2px solid #b58a2b;margin:4px 0 11px}.cert-signature b{display:block;font-size:21px;line-height:1.25}.cert-signature small{display:block;font-size:20px;line-height:1.3;color:#4b6178;margin-top:6px}.cert-seal{position:absolute;top:713px;left:50%;margin-left:-111px;width:222px;height:222px}.gold-seal{width:100%;height:100%}.cert-record{position:absolute;left:75px;right:75px;bottom:29px;display:flex;justify-content:center;align-items:center;gap:32px;color:#425d77;font-size:18px;line-height:1.3}.cert-record .divider{height:23px;width:2px;background:#b58a2b}.cert-record b{font-weight:normal;color:#183a56}.cert-verify{position:absolute;left:75px;right:75px;bottom:10px;margin:0;font-family:Arial,sans-serif;font-size:11px;line-height:1.2;color:#62738a;overflow-wrap:anywhere}.cert-verify a{color:inherit;text-decoration:none}
@page{size:280mm 218.4mm;margin:0}@media print{html,body{width:280mm;height:218.4mm;background:white}.cert-viewport{width:280mm!important;height:218.4mm!important;max-width:none;margin:0}.cert-canvas{transform:scale(.7559055118)!important}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><main class="cert-viewport" aria-label="Issued training completion certificate"><article class="cert-canvas"><div class="cert-paper"><div class="cert-brand">${logo}<strong>ALSAEED</strong><span>EDUCATION · TRAINING · CONSULTING</span></div>${isPmp?`<img class="cert-badge" src="${origin}/assets/badges/pmi-atp-instructor-pmp.png" alt="PMI Authorized Training Partner Instructor — PMP">`:''}<h1 class="cert-title">CERTIFICATE</h1><div class="cert-subtitle">OF COMPLETION</div><p class="cert-award">This certificate is awarded to</p><div class="cert-name"><span dir="auto">${escape(data.name)}</span></div><hr class="cert-rule"><p class="cert-completed">for successfully completing the training program</p><h2 class="cert-course"><span dir="auto">${escape(data.course)}</span></h2><p class="cert-hours">${data.hours?`${escape(data.hours)} Training Hours`:''}</p><div class="cert-signature left"><span class="cert-script">Mohamed Attia</span><hr class="cert-signature-line"><b>Dr. Mohamed Attia${isPmp?' · PMI-ATP':''}</b><small>Course Instructor</small></div><div class="cert-seal">${seal()}</div><div class="cert-signature right"><span class="cert-script">Alsaeed</span><hr class="cert-signature-line"><b>Alsaeed Education, Training &amp; Consulting</b></div><div class="cert-record"><span>Certificate No.: <b>${escape(data.no)}</b></span><span class="divider" aria-hidden="true"></span><span>Date of Issue: <b>${escape(issueDate)}</b></span></div>${verification?`<p class="cert-verify">Verification: <a href="${escape(verification)}">${escape(verification)}</a></p>`:''}</div></article></main></body></html>`;
    // Scale the print layout itself, so page fragmentation cannot crop transformed content.
    return html.replace(/<style>([\s\S]*?)<\/style>/, (_, css) => {
      const printCss=css.split('@page')[0].replace(/(-?\d+(?:\.\d+)?)px\b/g, (_, value) => (Number(value)*PRINT_SCALE).toFixed(5)+'px');
      return `<style>${css}\n@media print{${printCss}html,body,.cert-viewport{width:280mm!important;height:218.4mm!important}.cert-viewport{margin:0}.cert-canvas{position:relative;left:0;margin-left:0;transform:none!important}.cert-name{font-size:var(--certificate-name-print-size,${nameSize*PRINT_SCALE}px)!important}.cert-course{font-size:var(--certificate-course-print-size,${courseSize*PRINT_SCALE}px)!important}}</style>`;
    });
  }
  async function prepare(popup) {
    const doc = popup.document;
    await Promise.all([doc.fonts?.ready || Promise.resolve(), ...Array.from(doc.images).map(img => img.complete ? Promise.resolve() : new Promise(resolve => {img.onload=resolve;img.onerror=resolve;}))]);
    for (const selector of ['.cert-name','.cert-course']) {
      const box=doc.querySelector(selector), text=box?.firstElementChild;
      if(!box || !text || !box.clientWidth) continue;
      let size=parseFloat(popup.getComputedStyle(box).fontSize), minimum=18;
      while(size>minimum && (text.scrollWidth>box.clientWidth || text.scrollHeight>box.clientHeight)){size-=1;box.style.fontSize=size+'px';}
      box.style.setProperty(selector==='.cert-name'?'--certificate-name-print-size':'--certificate-course-print-size',(size*PRINT_SCALE)+'px');
    }
    const resize=()=>{const scale=Math.min(1,popup.innerWidth/WIDTH);doc.querySelector('.cert-canvas').style.setProperty('--certificate-scale',String(scale));doc.querySelector('.cert-viewport').style.height=(HEIGHT*scale)+'px';};
    resize();popup.addEventListener('resize',resize);
  }
  root.AlsaeedCertificate=Object.freeze({render,prepare,record,width:WIDTH,height:HEIGHT});
})(window);
