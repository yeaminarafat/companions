/* Companions of the Prophet ﷺ — app shell
   Data lives in data.js (window.DATA). Everything below is presentation + study state. */

/* ---------- storage (falls back to memory if localStorage is blocked) ---------- */
const KEY = 'companions.v1';
const Store = (() => {
  let mem = null, ok = true;
  try { const t = '__t'; localStorage.setItem(t, '1'); localStorage.removeItem(t); }
  catch (e) { ok = false; }
  const blank = { star: {}, known: {}, review: {}, tab: 'dir', daily: null, seen: [] };
  function read() {
    if (!ok) return mem || (mem = { ...blank });
    try { return Object.assign({ ...blank }, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return { ...blank }; }
  }
  function write(s) {
    if (!ok) { mem = s; return; }
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* quota — ignore */ }
  }
  return { read, write, available: ok };
})();
let S = Store.read();
const save = () => Store.write(S);

/* ---------- helpers ---------- */
const strip = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[ʿʾ'’‘ʻ]/g,'').replace(/[ḤḥṢṣḌḍṬṭẒẓĀāĪīŪūĒēŌō]/g, c=>({'Ḥ':'H','ḥ':'h','Ṣ':'S','ṣ':'s','Ḍ':'D','ḍ':'d','Ṭ':'T','ṭ':'t','Ẓ':'Z','ẓ':'z','Ā':'A','ā':'a','Ī':'I','ī':'i','Ū':'U','ū':'u','Ē':'E','ē':'e','Ō':'O','ō':'o'}[c]||c)).toLowerCase();
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');

const isFem = p => p.ra.endsWith('ها');
const bcls = b => b==='Martyr' ? 'bdg b-martyr' : (b==='Ten Promised Paradise' ? 'bdg b-ten' : 'bdg');

const byId = Object.fromEntries(DATA.people.map(p=>[p.id,p]));
/* the 189 companions — the "context" circle is kin and adversaries, not Companions */
const COMPANIONS = DATA.people.filter(p=>p.group!=='context');

/* index for timeline name -> person id */
const nameIndex = DATA.people.map(p => ({id:p.id, key:strip(p.name), name:p.name}));
function findPerson(label){
  const k = strip(label);
  if(k.length < 4) return null;
  let hit = nameIndex.find(n => n.key === k);
  if(!hit) hit = nameIndex.find(n => n.key.startsWith(k) || k.startsWith(n.key));
  if(!hit) hit = nameIndex.find(n => n.key.includes(k) || k.includes(n.key));
  return hit ? hit.id : null;
}

/* ---------- cross-links inside descriptions ---------- */
const NAME_RE = (()=>{
  const names = DATA.people.map(p=>({n:p.name,id:p.id})).sort((a,b)=>b.n.length-a.n.length);
  const escRe = t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return { re:new RegExp('('+names.map(x=>escRe(x.n)).join('|')+')','g'),
           map:Object.fromEntries(names.map(x=>[x.n,x.id])) };
})();
function linkify(escapedText, selfId){
  return escapedText.replace(NAME_RE.re, m=>{
    const id=NAME_RE.map[m];
    return (!id||id===selfId)?m:`<span class="plink" data-goto="${id}">${m}</span>`;
  });
}

/* ---------- al-Ṣallābī passage ---------- */
function sallabiHTML(p){
  if(!p.sallabi || !p.sallabi.text) return '';
  return `<details class="sal">
    <summary>In al-Ṣallābī's words <span class="salpg">p. ${esc(String(p.sallabi.page))}</span></summary>
    <blockquote>${esc(p.sallabi.text)}</blockquote>
    <cite>al-Ṣallābī, <i>The Noble Life of the Prophet ﷺ</i>, p. ${esc(String(p.sallabi.page))}</cite>
  </details>`;
}

/* ---------- family tree ---------- */
const hasFam = id => !!(window.FAMILY && FAMILY.rel[id] &&
  (FAMILY.rel[id].father||FAMILY.rel[id].mother||(FAMILY.rel[id].spouses||[]).length||(FAMILY.rel[id].children||[]).length||(FAMILY.rel[id].siblings||[]).length));

const BW=172, BH=88, GX=14, GY=52;

function gender(n){
  const t=(n.en||'')+' '+(n.ar||'');
  if(/\bbint\b|بنت|umm |أم /i.test(t)) return 'f';
  if(/\bibn\b|بن |\babu\b|أبو/i.test(t)) return 'm';
  return '?';
}
const ROLE={
  father:['Father','الأب'], mother:['Mother','الأم'],
  gf:['Grandfather','الجد'], gm:['Grandmother','الجدة'],
  spouse_m:['Husband','الزوج'], spouse_f:['Wife','الزوجة'], spouse:['Spouse','زوج'],
  child_m:['Son','الابن'], child_f:['Daughter','البنت'], child:['Child','من الأولاد'],
  sib_m:['Brother','الأخ'], sib_f:['Sister','الأخت'], sib:['Sibling','من الإخوة'],
};
function nodeInfo(r){
  if(!r) return null;
  if('r' in r){
    const p=byId[r.r]; if(!p) return null;
    return {en:p.name, ar:p.arabic, note:r.note, id:r.r, nav:hasFam(r.r)?'famnav':'goto', cls:'in', k:'r:'+r.r};
  }
  const e=FAMILY.ext[r.x]||{};
  return {en:e.en, ar:e.ar, note:r.note, cls:/النبي ﷺ/.test(e.ar||'')?'proph':'out', k:'x:'+r.x};
}
function roleFor(base,n){
  if(base==='spouse'||base==='child'||base==='sib'){
    const g=gender(n); return ROLE[base+(g==='?'?'':'_'+g)]||ROLE[base];
  }
  return ROLE[base];
}
function nodeFO(n,x,y,me,role){
  const attr = n.id ? (n.nav==='famnav'?`data-famnav="${n.id}"`:`data-goto="${n.id}"`) : '';
  const r = me?null:role;
  return `<foreignObject x="${x}" y="${y}" width="${BW}" height="${BH}">
    <div xmlns="http://www.w3.org/1999/xhtml" class="fnode ${n.cls} ${me?'me':''}" ${attr} title="${esc(n.en)}${n.note?' — '+esc(n.note):''}">
      ${r?`<span class="frole">${r[0]} · <span class="arabic">${r[1]}</span></span>`:''}
      <span class="fen">${esc(n.en)}</span><span class="far arabic">${esc(n.ar)}</span>${n.note?`<span class="fnote">${esc(n.note)}</span>`:''}
    </div></foreignObject>`;
}
const L=(x1,y1,x2,y2,cls='fl')=>`<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
function dbl(pts){  /* gold double polyline for marriage */
  let out='';
  for(let i=0;i<pts.length-1;i++){
    const [a,b]=pts[i],[c,d]=pts[i+1];
    const off = a===c ? [2.2,0] : [0,2.2];
    out+=L(a-off[0],b-off[1],c-off[0],d-off[1],'fl fm')+L(a+off[0],b+off[1],c+off[0],d+off[1],'fl fm');
  }
  return out;
}

function treeSVG(id){
  const rec=(FAMILY.rel||{})[id]||{};
  const me=byId[id];
  const father=nodeInfo(rec.father), mother=nodeInfo(rec.mother);
  const sibs=(rec.siblings||[]).map(nodeInfo).filter(Boolean);
  const spouses=(rec.spouses||[]).map(nodeInfo).filter(Boolean);
  const kids=(rec.children||[]).map(c=>{ const n=nodeInfo(c); if(n) n.via=c.via||null; return n; }).filter(Boolean);
  /* grandparents from the graph, only via roster parents */
  function gps(par){
    if(!par || !par.id) return [];
    const r=FAMILY.rel[par.id]||{};
    return [ r.father?{...nodeInfo(r.father),gr:'gf'}:null, r.mother?{...nodeInfo(r.mother),gr:'gm'}:null ].filter(Boolean);
  }
  const gpF=gps(father), gpM=gps(mother);
  const hasGp=gpF.length||gpM.length;

  /* rows y */
  let y=4;
  const yGp = hasGp? y : null; if(hasGp) y+=BH+GY;
  const yPar = (father||mother)? y : null; if(father||mother) y+=BH+GY;
  const ySelf = y; y+=BH+ (spouses.length?GY:0);
  const ySp = spouses.length? y : null; if(spouses.length) y+=BH+ (kids.length?GY:0);
  else if(kids.length) y+=GY;
  const yKid = kids.length? y : null; if(kids.length) y+=BH;
  const H=y+8;

  /* order children: grouped by spouse order, unknowns last */
  const spKeys=spouses.map(s=>s.k);
  kids.sort((a,b)=>{
    const ia=a.via?spKeys.indexOf(a.via):99, ib=b.via?spKeys.indexOf(b.via):99;
    return (ia<0?98:ia)-(ib<0?98:ib);
  });

  /* row widths & x origins */
  const wRow=n=>n*BW+(n-1)*GX;
  const selfN=1+sibs.length;
  const W=Math.max(wRow(selfN), wRow(Math.max(1,(father?1:0)+(mother?1:0))), wRow(Math.max(1,spouses.length)), wRow(Math.max(1,kids.length)), wRow(Math.max(1,gpF.length+gpM.length)))+16;
  const cxOf=(x)=>x+BW/2;

  let fo='', ln='';
  /* self + siblings (self leftmost, sibs to the right, row centred) */
  const selfX=(W-wRow(selfN))/2;
  const meCx=cxOf(selfX);
  fo+=nodeFO({en:me.name,ar:me.arabic,cls:'in'},selfX,ySelf,true);
  sibs.forEach((n,i)=>{ fo+=nodeFO(n,selfX+(i+1)*(BW+GX),ySelf,false,roleFor('sib',n)); });

  /* parents */
  let jx=meCx;
  if(father||mother){
    const pN=(father?1:0)+(mother?1:0);
    let pX=Math.min(Math.max(meCx-wRow(pN)/2,4),W-wRow(pN)-4);
    const drops=[];
    [father,mother].filter(Boolean).forEach((n,i)=>{
      const x=pX+i*(BW+GX);
      fo+=nodeFO(n,x,yPar,false,n===father?ROLE.father:ROLE.mother);
      drops.push({cx:cxOf(x), n});
    });
    const jy=yPar+BH+GY/2;
    drops.forEach(d=>ln+=L(d.cx,yPar+BH,d.cx,jy));
    if(drops.length===2) ln+=L(drops[0].cx,jy,drops[1].cx,jy);
    jx=drops.length===2?(drops[0].cx+drops[1].cx)/2:drops[0].cx;
    ln+=L(jx,jy,meCx,jy)+L(meCx,jy,meCx,ySelf);
    /* siblings share the junction */
    sibs.forEach((n,i)=>{ const cx=cxOf(selfX+(i+1)*(BW+GX)); ln+=L(Math.min(jx,cx),jy,Math.max(jx,cx),jy)+L(cx,jy,cx,ySelf); });
    /* grandparents above each parent */
    function drawGp(list, par){
      if(!list.length||!par) return;
      const pcx=drops.find(d=>d.n===par).cx;
      let gX=Math.min(Math.max(pcx-wRow(list.length)/2,4),W-wRow(list.length)-4);
      const gjy=yGp+BH+GY/2, gcxs=[];
      list.forEach((n,i)=>{ const x=gX+i*(BW+GX); fo+=nodeFO(n,x,yGp,false,ROLE[n.gr]); gcxs.push(cxOf(x)); });
      gcxs.forEach(c=>ln+=L(c,yGp+BH,c,gjy));
      if(gcxs.length===2) ln+=L(gcxs[0],gjy,gcxs[1],gjy);
      const gmid=gcxs.length===2?(gcxs[0]+gcxs[1])/2:gcxs[0];
      ln+=L(gmid,gjy,pcx,gjy)+L(pcx,gjy,pcx,yPar);
    }
    drawGp(gpF,father); drawGp(gpM,mother);
  } else if(sibs.length){
    sibs.forEach((n,i)=>{ const x=selfX+(i+1)*(BW+GX); ln+=L(selfX+BW,ySelf+BH/2,x,ySelf+BH/2); });
  }

  /* spouses row: marriage rail (double, gold) from person down, across, into each spouse */
  const spCxs=[];
  if(spouses.length){
    const sX=(W-wRow(spouses.length))/2;
    const ry=ySelf+BH+GY/2;
    spouses.forEach((n,i)=>{
      const x=sX+i*(BW+GX); const cx=cxOf(x); spCxs.push(cx);
      fo+=nodeFO(n,x,ySp,false,roleFor('spouse',n));
    });
    ln+=dbl([[meCx,ySelf+BH],[meCx,ry]]);
    ln+=dbl([[Math.min(meCx,...spCxs),ry],[Math.max(meCx,...spCxs),ry]]);
    spCxs.forEach(cx=>ln+=dbl([[cx,ry],[cx,ySp]]));
  }

  /* children row, elbow up to co-parent spouse (or to person) */
  if(kids.length){
    const kX=(W-wRow(kids.length))/2;
    const ky=yKid-GY/2;
    kids.forEach((n,i)=>{
      const x=kX+i*(BW+GX); const cx=cxOf(x);
      fo+=nodeFO(n,x,yKid,false,roleFor('child',n));
      const vi=n.via?spKeys.indexOf(n.via):-1;
      const tx=vi>=0?spCxs[vi]:meCx;
      const ty=vi>=0?ySp+BH:(spouses.length?ySelf+BH+GY/2:ySelf+BH);
      ln+=L(cx,yKid,cx,ky)+L(Math.min(cx,tx),ky,Math.max(cx,tx),ky)+L(tx,ky,tx,ty);
    });
  }
  return `<div class="ftwrap"><svg class="ftree" data-mecx="${meCx}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${ln}${fo}</svg></div>`;
}

function openFam(id){
  const p=byId[id], rec=(FAMILY.rel||{})[id]||{};
  const ov=document.getElementById('famov');
  ov.innerHTML=`<div class="fbox">
    <button class="fclose" id="fclose">✕</button>
    <div class="fhead">
      <div class="fname">${esc(p.name)} ${p.ra?`<span class="ra">${p.ra}</span>`:''}</div>
      <div class="fnamear arabic">${esc(p.arabic)}</div>
      ${rec.clan?`<div class="fclan">${esc(rec.clan.en)} · <span class="arabic">${esc(rec.clan.ar)}</span></div>`:''}
    </div>
    ${treeSVG(id)}
    <div class="flegend">Single line: blood · double gold line: marriage · children sit beneath the parent they were born to · tap a purple box to walk the family · grey boxes are outside this directory</div>
    <button class="btn" data-goto="${id}">Open ${esc(p.name)}'s entry →</button>
  </div>`;
  ov.style.display='flex';
  const wrap=ov.querySelector('.ftwrap'), svg=ov.querySelector('.ftree');
  if(wrap&&svg) wrap.scrollLeft = (+svg.dataset.mecx||0) - wrap.clientWidth/2;
  document.getElementById('fclose').addEventListener('click', closeFam);
  ov.addEventListener('click', e=>{ if(e.target===ov) closeFam(); }, {once:true});
  ov.querySelectorAll('[data-famnav]').forEach(b=>b.addEventListener('click',()=>openFam(b.dataset.famnav)));
  ov.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>{ closeFam(); gotoPerson(b.dataset.goto); }));
}
function closeFam(){ document.getElementById('famov').style.display='none'; }

/* ---------- render directory ---------- */
function cardHTML(p){
  const badges = p.badges.map(b=>`<span class="${bcls(b)}">${esc(b)}</span>`).join('');
  return `<div class="card ${p.tier} ${p.group==='context'?'ctx':''}" id="p-${p.id}" data-id="${p.id}">
    <div class="nrow"><span class="nm">${esc(p.name)} ${p.ra?`<span class="ra">${p.ra}</span>`:''}${p.dyr?`<span class="dyr">${esc(p.dyr)}</span>`:''}</span><span class="ar">${esc(p.arabic)}</span></div>
    ${p.kunya_titles?`<div class="kunya">${esc(p.kunya_titles)}</div>`:''}
    <div class="who">${esc(p.who)}</div>
    ${p.who_ar?`<div class="whoar arabic">${esc(p.who_ar)}</div>`:''}
    ${badges?`<div class="badges">${badges}</div>`:''}
    <div class="detail">
      <div class="story">${linkify(esc(p.story), p.id)}</div>
      ${p.book_moments&&p.book_moments.length?`<div class="moments"><h4>In the book</h4><ul>${p.book_moments.map(m=>`<li>${esc(m)}</li>`).join('')}</ul></div>`:''}
      ${p.after_sirah?`<div class="after"><h4>After the sirah — beyond this book</h4><p>${esc(p.after_sirah)}</p></div>`:''}
      ${p.death?`<div class="dth"><h4>Departure</h4>${esc(p.death)}</div>`:''}
      ${sallabiHTML(p)}
      ${p.beyond_sources&&p.beyond_sources.length?`<div class="srcline"><b>Beyond-the-book sources:</b> ${p.beyond_sources.map(esc).join(' · ')}</div>`:''}
    </div>
    <div class="acts">
      <button class="act" data-a="star" title="Star this companion">★ Star</button>
      <button class="act" data-a="known" title="Mark as known">✓ Known</button>
      <button class="act" data-a="review" title="Flag for review">↺ Review</button>
      ${hasFam(p.id)?`<button class="act fam" data-fam="${p.id}">⚯ Family</button>`:''}
      <span class="expand-hint">tap to expand</span>
    </div>
  </div>`;
}

function renderDir(){
  const root = document.getElementById('dir');
  let nav = '<div class="groupnav">' + DATA.groups.map(g=>`<a class="gn" href="#g-${g.id}">${esc(g.title)}</a>`).join('') + '</div>';
  let html = nav;
  for(const g of DATA.groups){
    const ppl = DATA.people.filter(p=>p.group===g.id);
    const majors = ppl.filter(p=>p.tier==='major'), minors = ppl.filter(p=>p.tier==='minor');
    html += `<section class="group" id="g-${g.id}" data-g="${g.id}">
      <div class="ghead"><h2>${esc(g.title)}</h2><div class="gsub">${esc(g.sub)}</div></div>
      <div class="gcount">${ppl.length} ${g.id==='context'?'figures':'companions'}</div>
      ${majors.length?`<div class="cards">${majors.map(cardHTML).join('')}</div>`:''}
      ${minors.length?`${majors.length?`<div class="minor-note">Also in this circle</div>`:''}<div class="cards">${minors.map(cardHTML).join('')}</div>`:''}
    </section>`;
  }
  root.innerHTML = html;
  root.querySelectorAll('.card').forEach(c=>{
    c.addEventListener('click', e=>{
      const pl=e.target.closest('.plink');
      if(pl){ e.stopPropagation(); gotoPerson(pl.dataset.goto); return; }
      const bd=e.target.closest('.bdg');
      if(bd){ e.stopPropagation(); filterByBadge(bd.textContent.trim()); return; }
      if(e.target.closest('.act') || e.target.closest('.sal')) return;
      c.classList.toggle('open');
    });
    c.querySelectorAll('.act').forEach(b=>b.addEventListener('click', e=>{
      e.stopPropagation();
      if(b.dataset.fam) return openFam(b.dataset.fam);
      toggleMark(c.dataset.id, b.dataset.a);
    }));
  });
  paintMarks();
}

/* ---------- study state ---------- */
function toggleMark(id, kind){
  const on = !S[kind][id];
  if(on) S[kind][id] = 1; else delete S[kind][id];
  /* known and review are opposites — marking one clears the other */
  if(on && kind==='known') delete S.review[id];
  if(on && kind==='review') delete S.known[id];
  save();
  paintMarks();
  if(currentTab==='study') renderStudy();
  if(filter.startsWith('__')) applyFilter();
}

function paintMarks(){
  document.querySelectorAll('#dir .card').forEach(c=>{
    const id = c.dataset.id;
    c.classList.toggle('is-known', !!S.known[id]);
    c.classList.toggle('is-star', !!S.star[id]);
    c.querySelectorAll('.act[data-a]').forEach(b=>b.classList.toggle('on', !!S[b.dataset.a][id]));
  });
  const known = COMPANIONS.filter(p=>S.known[p.id]).length;
  const pct = Math.round(known / COMPANIONS.length * 100);
  document.getElementById('pfill').style.width = pct + '%';
  document.getElementById('plabel').textContent =
    `${known} of ${COMPANIONS.length} marked known${pct?` · ${pct}%`:''}`;
}

/* ---------- daily companion ---------- */
function todayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dailyPerson(){
  const key = todayKey();
  if(S.daily && S.daily.date === key && byId[S.daily.id]) return byId[S.daily.id];
  /* prefer someone not yet known, and not served in the last 60 days */
  const recent = new Set((S.seen||[]).slice(-60).map(x=>x.id));
  let pool = COMPANIONS.filter(p=>!S.known[p.id] && !recent.has(p.id));
  if(!pool.length) pool = COMPANIONS.filter(p=>!recent.has(p.id));
  if(!pool.length) pool = COMPANIONS;
  /* deterministic for the day: hash the date string */
  let h = 0; for(const ch of key) h = (h*31 + ch.charCodeAt(0)) >>> 0;
  const pick = pool[h % pool.length];
  S.daily = { date: key, id: pick.id };
  S.seen = (S.seen||[]).concat([{date:key, id:pick.id}]).slice(-120);
  save();
  return pick;
}

/* ---------- render study tab ---------- */
function personChips(ids, emptyMsg){
  if(!ids.length) return `<div class="empty">${emptyMsg}</div>`;
  return '<div class="lst">' + ids.map(id=>`<span class="lnk" data-goto="${id}">${esc(byId[id].name)}</span>`).join('') + '</div>';
}
function renderStudy(){
  const p = dailyPerson();
  const known = COMPANIONS.filter(x=>S.known[x.id]).length;
  const starIds = Object.keys(S.star).filter(id=>byId[id]);
  const revIds = Object.keys(S.review).filter(id=>byId[id]);
  const badges = p.badges.map(b=>`<span class="${bcls(b)}">${esc(b)}</span>`).join('');
  document.getElementById('study').innerHTML = `
    <div class="panel daily">
      <div class="lead" style="margin-bottom:10px">Companion of the day · ${esc(todayKey())}</div>
      <div class="dname">${esc(p.name)} ${p.ra?`<span class="ra">${p.ra}</span>`:''}${p.dyr?`<span class="dyr">${esc(p.dyr)}</span>`:''}</div>
      <span class="dar">${esc(p.arabic)}</span>
      ${p.kunya_titles?`<div class="kunya" style="margin-top:6px">${esc(p.kunya_titles)}</div>`:''}
      ${badges?`<div class="badges">${badges}</div>`:''}
      <div class="dwho">${esc(p.who)}</div>
      ${p.who_ar?`<div class="whoar arabic">${esc(p.who_ar)}</div>`:''}
      <div class="dstory">${esc(p.story)}</div>
      ${p.book_moments&&p.book_moments.length?`<div class="moments"><h4>In the book</h4><ul>${p.book_moments.map(m=>`<li>${esc(m)}</li>`).join('')}</ul></div>`:''}
      ${p.death?`<div class="dth"><h4>Departure</h4>${esc(p.death)}</div>`:''}
      ${sallabiHTML(p)}
      <div><button class="btn" data-goto="${p.id}">Open the full entry →</button>
      <button class="btn" id="dailyKnown">${S.known[p.id]?'✓ Marked known':'Mark as known'}</button></div>
    </div>

    <div class="tiles">
      <div class="tile"><b>${known}</b><span>Known</span></div>
      <div class="tile"><b>${COMPANIONS.length - known}</b><span>Remaining</span></div>
      <div class="tile"><b>${starIds.length}</b><span>Starred</span></div>
      <div class="tile"><b>${revIds.length}</b><span>To review</span></div>
    </div>

    <div class="panel">
      <h2>Starred</h2>
      <div class="lead">The ones you keep coming back to.</div>
      ${personChips(starIds, 'Nothing starred yet — tap ★ Star on any card.')}
    </div>

    <div class="panel">
      <h2>Still shaky</h2>
      <div class="lead">Flagged for another pass.</div>
      ${personChips(revIds, 'Nothing flagged — tap ↺ Review on a card you want to come back to.')}
    </div>

    <div class="panel">
      <h2>Your data</h2>
      <div class="lead">Everything is stored on this device only — nothing leaves it${Store.available?'':' (storage is blocked in this browser, so marks last only for this visit)'}.</div>
      <button class="btn" id="exportBtn">Export progress</button>
      <button class="btn" id="importBtn">Import progress</button>
      <button class="btn" id="resetBtn">Reset all marks</button>
      <input type="file" id="importFile" accept="application/json" style="display:none">
    </div>`;

  document.querySelectorAll('#study [data-goto]').forEach(el=>el.addEventListener('click',()=>gotoPerson(el.dataset.goto)));
  document.getElementById('dailyKnown').addEventListener('click',()=>toggleMark(p.id,'known'));
  document.getElementById('exportBtn').addEventListener('click', exportProgress);
  document.getElementById('importBtn').addEventListener('click', ()=>document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importProgress);
  document.getElementById('resetBtn').addEventListener('click', ()=>{
    if(confirm('Clear every star, known and review mark? This cannot be undone.')){
      S = { star:{}, known:{}, review:{}, tab:S.tab, daily:S.daily, seen:S.seen };
      save(); paintMarks(); renderStudy();
    }
  });
}

function exportProgress(){
  const blob = new Blob([JSON.stringify(S,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `companions-progress-${todayKey()}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
}
function importProgress(e){
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const inc = JSON.parse(r.result);
      S = Object.assign(S, {
        star: Object.assign({}, S.star, inc.star||{}),
        known: Object.assign({}, S.known, inc.known||{}),
        review: Object.assign({}, S.review, inc.review||{})
      });
      save(); paintMarks(); renderStudy();
    }catch(err){ alert('That file could not be read as progress data.'); }
  };
  r.readAsText(f);
  e.target.value = '';
}

function gotoPerson(id){
  switchTab('dir');
  filter = 'all';
  document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active', c.dataset.f==='all'));
  document.getElementById('search').value = '';
  applyFilter();
  const card = document.getElementById('p-'+id);
  if(card){
    card.classList.add('open');
    setTimeout(()=>{ card.scrollIntoView({behavior:'smooth',block:'center'});
      card.classList.remove('hl'); void card.offsetWidth; card.classList.add('hl'); },60);
  }
}

/* ---------- render timeline ---------- */
const BATTLE = /battle|conquest|siege|expedition|massacre|muʾtah|mu'tah|khandaq|assassin/i;
function renderTL(){
  const root = document.getElementById('tl');
  let nav = '<div class="eranav">' + DATA.timeline.eras.map((e,i)=>`<a class="gn" href="#era-${i}">${esc(e.title)}</a>`).join('') + '</div>';
  let html = nav;
  DATA.timeline.eras.forEach((era,i)=>{
    html += `<div class="era" id="era-${i}"><h2>${esc(era.title)}</h2>`;
    for(const ev of era.events){
      const ppl = (ev.people||[]).map(nm=>{
        const id = findPerson(nm);
        return id ? `<span class="pp linked" data-goto="${id}">${esc(nm)}</span>` : `<span class="pp nolink">${esc(nm)}</span>`;
      }).join('');
      html += `<div class="ev ${BATTLE.test(ev.title)?'battle':''}">
        <div class="when"><div class="ce">${esc(ev.year||'')}</div><div class="ah">${esc(ev.ah||'')}</div></div>
        <div class="dot"></div>
        <div class="evbody"><h3>${esc(ev.title)}${ev.chapter?`<span class="ch">${esc(ev.chapter)}</span>`:''}</h3>
          <p>${esc(ev.desc)}</p>${ppl?`<div class="ppl">${ppl}</div>`:''}</div>
      </div>`;
    }
    html += '</div>';
  });
  root.innerHTML = html;
  root.querySelectorAll('.pp.linked').forEach(el=>el.addEventListener('click',()=>gotoPerson(el.dataset.goto)));
}

/* ---------- tabs ---------- */
let currentTab = 'dir';
function switchTab(t){
  currentTab = t;
  S.tab = t; save();
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===t));
  document.getElementById('dir').style.display = t==='dir'?'block':'none';
  document.getElementById('dirControls').style.display = t==='dir'?'block':'none';
  document.getElementById('tl').style.display = t==='tl'?'block':'none';
  document.getElementById('study').style.display = t==='study'?'block':'none';
  document.getElementById('quiz').style.display = t==='quiz'?'block':'none';
  document.getElementById('nores').style.display='none';
  if(t==='study') renderStudy();
  if(t==='quiz') renderQuizHome();
  if(t==='dir') applyFilter();
  window.scrollTo({top:0});
}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));

function filterByBadge(b){
  switchTab('dir');
  document.getElementById('search').value='';
  filter=b;
  document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active', c.dataset.f===b));
  applyFilter();
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ---------- search & filters ---------- */
let filter='all';
document.querySelectorAll('.chip').forEach(ch=>ch.addEventListener('click',()=>{
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
  ch.classList.add('active'); filter=ch.dataset.f; applyFilter();
}));
document.getElementById('search').addEventListener('input', applyFilter);

function applyFilter(){
  const q = strip(document.getElementById('search').value.trim());
  let any=false;
  document.querySelectorAll('#dir .card').forEach(c=>{
    const p = byId[c.dataset.id];
    let ok = true;
    if(filter==='major') ok = p.tier==='major';
    else if(filter==='women') ok = isFem(p);
    else if(filter==='__star') ok = !!S.star[p.id];
    else if(filter==='__review') ok = !!S.review[p.id];
    else if(filter==='__known') ok = !!S.known[p.id];
    else if(filter==='__unknown') ok = p.group!=='context' && !S.known[p.id];
    else if(filter!=='all') ok = p.badges.includes(filter);
    if(ok && q){
      const hay = strip([p.name,p.kunya_titles,p.who,p.story,(p.book_moments||[]).join(' '),p.badges.join(' ')].join(' ')) + ' ' + p.arabic;
      ok = hay.includes(q);
    }
    c.style.display = ok?'block':'none';
    if(ok) any=true;
  });
  document.querySelectorAll('section.group').forEach(s=>{
    const vis = [...s.querySelectorAll('.card')].some(c=>c.style.display!=='none');
    s.style.display = vis?'block':'none';
  });
  document.getElementById('nores').style.display = any?'none':'block';
}

/* ---------- install banner ---------- */
const banner = document.getElementById('install');
const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let deferredPrompt = null;

function showBanner(html, withButton){
  if(localStorage_getDismissed()) return;
  banner.innerHTML = html + `<div class="row">${withButton?'<button id="doInstall">Install</button>':''}<button class="ghost" id="dismissInstall">Not now</button></div>`;
  banner.style.display = 'block';
  const d = document.getElementById('dismissInstall');
  if(d) d.addEventListener('click', ()=>{ banner.style.display='none'; localStorage_setDismissed(); });
  const i = document.getElementById('doInstall');
  if(i) i.addEventListener('click', async ()=>{
    banner.style.display='none';
    if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt = null; }
  });
}
function localStorage_getDismissed(){ try{ return localStorage.getItem('companions.installDismissed')==='1'; }catch(e){ return false; } }
function localStorage_setDismissed(){ try{ localStorage.setItem('companions.installDismissed','1'); }catch(e){} }

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  showBanner('<b>Install this on your device</b><br>Add it to your home screen for fullscreen, offline access.', true);
});

if(!standalone && isIOS){
  setTimeout(()=>showBanner('<b>Add to your Home Screen</b><br>Tap the <b>Share</b> button at the bottom of Safari (the square with an arrow), then choose <b>Add to Home Screen</b>. It will open fullscreen and work with no signal.', false), 2500);
}

/* ---------- service worker ---------- */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js')
      .then(reg => { reg.update(); setInterval(()=>reg.update(), 60*60*1000); })
      .catch(()=>{ /* file:// or unsupported — app still works online */ });
    /* reload once when a NEW version replaces an old one — not on first install */
    const hadController = !!navigator.serviceWorker.controller;
    let swapped = false;
    navigator.serviceWorker.addEventListener('controllerchange', ()=>{
      if(!hadController || swapped || !navigator.serviceWorker.controller) return;
      swapped = true; location.reload();
    });
  });
}

/* ---------- go ---------- */
renderDir();
renderTL();
const qsTab = new URLSearchParams(location.search).get('tab');   /* home-screen shortcuts */
const TABS = ['dir','tl','study','quiz'];
const openTab = TABS.includes(qsTab) ? qsTab : (TABS.includes(S.tab) ? S.tab : 'dir');
switchTab(openTab);
