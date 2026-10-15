import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';const {JSDOM}=await import(process.env.JSDOM_MODULE || 'jsdom');
const base=process.cwd();
const canonicalTitle='Project Management Professional (PMP)® Preparation Course';
const context={window:{location:{origin:'https://al-ltc.com'},LOGO:()=>'<svg viewBox="0 0 600 567"><path d="M0 0h600v567z"/></svg>'},URL,Intl,Date};vm.createContext(context);vm.runInContext(fs.readFileSync(base+'/public/completion-certificate.js','utf8'),context);const api=context.window.AlsaeedCertificate;
const original={no:'PREVIEW-NOT-ISSUED',name:'Synthetic Learner',course:'Project Management Professional (PMP) Preparation Course',courseId:'pmp',hours:35,issued:Date.UTC(2020,1,3),verify:'https://al-ltc.com/verify/PREVIEW-NOT-ISSUED'};
test('saved name, hours, serial and historical issue date remain intact while PMP title is canonical',()=>{const doc=new JSDOM(api.render(original)).window.document;assert.equal(doc.querySelector('.cert-name').textContent,original.name);assert.equal(doc.querySelector('.cert-course').textContent,canonicalTitle);assert.match(doc.querySelector('.cert-hours').textContent,/35 Training Hours/);assert.match(doc.querySelector('.cert-record').textContent,/03 February 2020/);assert.match(doc.querySelector('.cert-record').textContent,/PREVIEW-NOT-ISSUED/);});
test('legacy titles remain dynamic without newly inferred instructor credentials',()=>{for(const id of ['pmp','rmp','pba','acp','grcp','lss','p3o','nebosh','aipro']){const doc=new JSDOM(api.render({...original,courseId:id,course:'Program '+id,hours:21})).window.document;assert.equal(doc.querySelector('.cert-course').textContent,id==='pmp'?canonicalTitle:'Program '+id);assert.equal(doc.querySelector('.cert-instructor-badge'),null);assert.equal(doc.querySelector('.cert-signature.left').textContent.includes('PMI-ATP'),false);}});
test('HTML in data is escaped and off-site verification URLs are not linked',()=>{const attack='<img src=x onerror=alert(1)>';const doc=new JSDOM(api.render({...original,courseId:'rmp',name:attack,course:attack,no:attack,verify:'https://outside.invalid/verify/x'})).window.document;assert.equal(doc.querySelector('.cert-name').textContent,attack);assert.equal(doc.querySelector('.cert-course').textContent,attack);assert.equal(doc.querySelectorAll('[onerror]').length,0);assert.equal(doc.querySelector('.cert-verify'),null);assert.equal(doc.querySelectorAll('script').length,0);});
test('missing issuance fields reject rendering; missing historical hours are not invented',()=>{for(const change of [{issued:undefined},{issued:NaN},{issued:0},{name:''},{no:''},{course:''}])assert.throws(()=>api.render({...original,...change}));assert.equal(new JSDOM(api.render({...original,hours:0})).window.document.querySelector('.cert-hours').textContent,'');});
test('print canvas preserves reference aspect ratio without a fabricated handwritten signature',()=>{const html=api.render(original);assert.match(html,/size:280mm 218.4mm/);assert(!html.includes('Allura-Regular.ttf'));assert.match(html,/Instructor signature/);assert.equal(api.width/api.height,1400/1092);});
test('maximum permitted wide-letter name starts small enough for two print lines',()=>{const html=api.render({...original,name:'W'.repeat(100)});const font=Number(html.match(/\.cert-name\{[^}]*font-size:([\d.]+)px/)[1]);assert(font<=21);assert(font>=18);assert(html.includes('W'.repeat(100)));});
test('responsive preview uniformly scales while print fitting follows real text measurements',async()=>{const styles={};let size=66;const box={clientWidth:1114,clientHeight:92,style:{set fontSize(value){size=parseFloat(value);},setProperty(k,v){styles[k]=v;}}};box.firstElementChild={get scrollWidth(){return 1114;},get scrollHeight(){return Math.ceil(100*size*1.1/1114)*size*1.08;}};const canvas={style:{setProperty(k,v){styles[k]=v;}}},viewport={style:{}};let listener;const popup={innerWidth:375,document:{fonts:{ready:Promise.resolve()},images:[],querySelector:s=>s==='.cert-name'?box:s==='.cert-canvas'?canvas:s==='.cert-viewport'?viewport:null},getComputedStyle:()=>({fontSize:size+'px'}),addEventListener:(name,fn)=>{assert.equal(name,'resize');listener=fn;}};await api.prepare(popup);assert(size<32);assert(box.firstElementChild.scrollHeight<=box.clientHeight);assert.equal(Number(styles['--certificate-scale']),375/1400);assert.equal(viewport.style.height,1092*375/1400+'px');assert(listener);assert(Number.parseFloat(styles['--certificate-name-print-size'])<size);});

test('PMP historical-record fixtures use the exact English title regardless of historic saved title',()=>{
  for(const course of [
    'Project Management Professional (PMP) Preparation Course',
    'Project Management Professional (PMP)',
    'PMP®',
    'محترف إدارة المشاريع',
    'محترف إدارة المشاريع — PMP®',
    canonicalTitle,
    '<img src=x onerror=alert(1)>',
    'W'.repeat(300)
  ]){
    const data=Object.freeze({...original,course,issued:Date.UTC(2019,5,7)});
    const before=JSON.stringify(data);
    const doc=new JSDOM(api.render(data)).window.document;
    assert.equal(doc.querySelector('.cert-course').textContent,canonicalTitle);
    assert.equal(doc.documentElement.lang,'en');
    assert.equal(doc.documentElement.dir,'ltr');
    assert.equal(doc.querySelector('.cert-name').textContent,data.name);
    assert.equal(doc.querySelector('.cert-hours').textContent,'35 Training Hours');
    assert.match(doc.querySelector('.cert-record').textContent,/07 June 2019/);
    assert.match(doc.querySelector('.cert-record').textContent,/PREVIEW-NOT-ISSUED/);
    assert.equal(JSON.stringify(data),before);
    assert.equal(doc.querySelectorAll('[onerror]').length,0);
    assert.equal(doc.querySelectorAll('script').length,0);
  }
});
test('no title inference or substring matching can turn non-PMP records into PMP certificates',()=>{
  for(const courseId of [undefined,null,'','PMP','Pmp',' pmp','pmp ','pmp-advanced','intro-pmp','rmp','pgmp','pfmp','capm']){
    for(const course of [canonicalTitle,'PMP® preparation plus other topics','محترف إدارة المشاريع']){
      const data=Object.freeze({...original,courseId,course});
      const before=JSON.stringify(data);
      const doc=new JSDOM(api.render(data)).window.document;
      assert.equal(doc.querySelector('.cert-course').textContent,course);
      assert.equal(doc.querySelector('.cert-badge'),null);
      assert(!doc.querySelector('.cert-signature.left').textContent.includes('PMI-ATP'));
      assert.equal(JSON.stringify(data),before);
    }
  }
});
test('PMP display sizing is calculated from the canonical title, independently of saved title',()=>{
  const css=course=>api.render({...original,course}).match(/\.cert-course\{[^}]*font-size:([\d.]+)px/)[1];
  assert.equal(css('PMP'),css('W'.repeat(300)));
  assert.equal(css('PMP'),css(canonicalTitle));
});
