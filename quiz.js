/* Companions — tiered quiz engine
   Tier 1 Recognise · Tier 2 Recall · Tier 3 Connect
   Modes: round of 10 · endless · review (spaced repetition)
   Depends on app.js (DATA, COMPANIONS, byId, esc, strip, S, save, toggleMark, gotoPerson) */

const TIERS = [
  {n:1, key:'recognise', name:'Recognise', blurb:'A scene, a description, a name — put a face to it.'},
  {n:2, key:'recall',    name:'Recall',    blurb:'Fewer clues. Titles, tribes, departures, what they were known for.'},
  {n:3, key:'connect',   name:'Connect',   blurb:'Where they stood in the story — events, order, who was there.'},
];
const UNLOCK = 15;   /* correct answers in a tier before the next opens */

/* ---------- quiz state ---------- */
function qs(){
  if(!S.quiz) S.quiz = {srs:{}, tier:{1:{a:0,c:0},2:{a:0,c:0},3:{a:0,c:0}}, best:0};
  for(const t of [1,2,3]) if(!S.quiz.tier[t]) S.quiz.tier[t]={a:0,c:0};
  if(!S.quiz.srs) S.quiz.srs={};
  if(!S.quiz.scope) S.quiz.scope='all';
  return S.quiz;
}
/* subject pool honours the study scope; distractors always come from everyone */
function subjPool(){
  if(qs().scope==='known'){ const k=COMPANIONS.filter(p=>S.known[p.id]); if(k.length) return k; }
  return COMPANIONS;
}
/* sentence-aware truncation — never cut mid-word */
function trunc(t,max){
  t=(t||'').trim(); if(t.length<=max) return t;
  const cut=t.slice(0,max);
  const m=[...cut.matchAll(/[.!?][”"']?\s/g)];
  return m.length? cut.slice(0,m[m.length-1].index+1) : cut.slice(0,cut.lastIndexOf(' '))+'…';
}
const today = () => Math.floor(Date.now()/864e5);

function schedule(id, correct){
  const q = qs(); const c = q.srs[id] || {e:2.5, i:0, due:today(), lapses:0};
  if(correct){ c.i = c.i===0 ? 1 : (c.i===1 ? 3 : Math.round(c.i*c.e)); c.e = Math.min(2.8, c.e+0.05); }
  else { c.i = 0; c.e = Math.max(1.3, c.e-0.25); c.lapses++; }
  c.due = today() + c.i;
  q.srs[id] = c; save();
}
const dueIds = () => COMPANIONS.filter(p => { const c=qs().srs[p.id]; return c && c.due<=today(); }).map(p=>p.id);
const unlocked = t => t===1 || qs().tier[t-1].c >= UNLOCK;

/* ---------- helpers ---------- */
function shuffle(a){ const r=a.slice(); for(let i=r.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [r[i],r[j]]=[r[j],r[i]]; } return r; }
const pick = a => a[Math.floor(Math.random()*a.length)];

/* mask every form of a person's name inside a passage */
function mask(text, p){
  const toks = (p.name+' '+(p.kunya_titles||'')).split(/[\s;,()]+/)
    .filter(w => w.length>=4 && !/^(ibn|bint|abu|abi|umm|the|and|his|her)$/i.test(w))
    .map(w => strip(w)).filter(Boolean);
  if(!toks.length) return text;
  const set = new Set(toks);
  /* compare word-by-word on a normalised basis, so ʿAlī / 'Ali / Alee all match */
  const out = text.replace(/[\p{L}\u02BF\u02BE'’‘-]+/gu, w => set.has(strip(w)) ? '———' : w);
  return out.replace(/(———[\s'’-]*)+/g, '——— ')
            .replace(/\s{2,}/g,' ')
            .replace(/\s+([,.;:!?%)\]])/g,'$1')
            .replace(/——— ?'s/g,'———’s').trim();
}

/* distractors: same circle first, then same tier, then anyone */
function others(p, n){
  const same = COMPANIONS.filter(x => x.id!==p.id && x.group===p.group);
  const tier = COMPANIONS.filter(x => x.id!==p.id && x.tier===p.tier && x.group!==p.group);
  const rest = COMPANIONS.filter(x => x.id!==p.id);
  const out=[]; const seen=new Set([p.id]);
  for(const pool of [shuffle(same), shuffle(tier), shuffle(rest)]){
    for(const x of pool){ if(out.length>=n) break; if(!seen.has(x.id)){ out.push(x); seen.add(x.id); } }
    if(out.length>=n) break;
  }
  return out;
}
const groupTitle = g => (DATA.groups.find(x=>x.id===g)||{}).title || g;

/* first sentence(s) of a story, masked */
function scenePassage(p){
  const src = (p.story||'').split(/(?<=[.!?])\s+/).filter(s=>s.length>60);
  if(!src.length) return null;
  const start = Math.floor(Math.random()*Math.max(1, src.length-1));
  let t = mask(src.slice(start, start+2).join(' '), p).trim();
  if(t.length > 420){                       /* never cut mid-word or mid-sentence */
    const cut = t.slice(0, 420);
    const m = [...cut.matchAll(/[.!?][”"']?\s/g)];
    t = m.length ? cut.slice(0, m[m.length-1].index+1) : cut.slice(0, cut.lastIndexOf(' ')) + '…';
  }
  return t;
}

/* ---------- question generators ---------- */
function qScene(){                                   /* T1 */
  const pool = subjPool().filter(p => (p.story||'').length>200);
  for(let k=0;k<12;k++){
    const p = pick(pool); const passage = scenePassage(p);
    if(passage && passage.includes('———')){
      return {subject:p.id, prompt:'Who is this?', body:passage,
              options: shuffle([p, ...others(p,3)]).map(x=>({label:x.name, right:x.id===p.id})),
              because:p.who};
    }
  }
  return null;
}
function qWho(){                                     /* T1 */
  const p = pick(subjPool().filter(x=>x.who)); if(!p) return null;
  return {subject:p.id, prompt:`Who was ${p.name}?`, body:'',
          options: shuffle([{label:p.who, right:true}, ...others(p,3).map(x=>({label:x.who, right:false}))]),
          because:p.who};
}
function qArabic(){                                  /* T1 */
  const p = pick(subjPool().filter(x=>x.arabic)); if(!p) return null;
  return {subject:p.id, prompt:'Whose name is this?', body:`<span class="qar">${esc(p.arabic)}</span>`,
          options: shuffle([p, ...others(p,3)]).map(x=>({label:x.name, right:x.id===p.id})),
          because:`${p.name} — ${p.who}`};
}
function qCircle(){                                  /* T2 */
  const p = pick(subjPool()); if(!p) return null;
  const wrong = shuffle(DATA.groups.filter(g=>g.id!==p.group && g.id!=='context')).slice(0,3);
  return {subject:p.id, prompt:`Which circle does ${p.name} belong to?`, body:'',
          options: shuffle([{label:groupTitle(p.group), right:true}, ...wrong.map(g=>({label:g.title, right:false}))]),
          because:`${p.name} — ${p.who}`};
}
function qTitle(){                                   /* T2 */
  const pool = subjPool().filter(x=>x.kunya_titles && x.kunya_titles.length>8); if(!pool.length) return null;
  const p = pick(pool);
  return {subject:p.id, prompt:'Who carried these titles?', body:`<span class="qtitle">${esc(p.kunya_titles)}</span>`,
          options: shuffle([p, ...others(p,3)]).map(x=>({label:x.name, right:x.id===p.id})),
          because:`${p.name} — ${p.who}`};
}
function qDeath(){                                   /* T2 */
  const pool = subjPool().filter(x=>x.dyr && x.death); if(!pool.length) return null;
  const p = pick(pool);
  const wrong = shuffle(pool.filter(x=>x.dyr!==p.dyr)).slice(0,3);
  return {subject:p.id, prompt:`When did ${p.name} die?`, body:'',
          options: shuffle([{label:p.dyr, right:true}, ...wrong.map(x=>({label:x.dyr, right:false}))]),
          because:p.death};
}
function qBadge(){                                   /* T2 */
  const pool = subjPool().filter(x=>x.badges && x.badges.length); if(!pool.length) return null;
  const p = pick(pool);
  const b = pick(p.badges);
  const wrongPool = COMPANIONS.filter(x=>!(x.badges||[]).includes(b));
  return {subject:p.id, prompt:`Which of these is described as: ${b}?`, body:'',
          options: shuffle([{label:p.name, right:true}, ...shuffle(wrongPool).slice(0,3).map(x=>({label:x.name, right:false}))]),
          because:`${p.name} — ${p.who}`};
}


function relName(r){ if(!r) return null; if('r' in r){const p=byId[r.r]; return p?p.name:null;} return (FAMILY.ext[r.x]||{}).en||null; }
function tokOverlap(a,b){
  const T=s=>new Set(String(s).split(/\s+/).map(strip).filter(w=>w.length>=4&&!/^(ibn|bint|abu|abi|umm|the)$/.test(w)));
  const A=T(a),B=T(b); for(const w of A) if(B.has(w)) return true; return false;
}
function qFamily(){                                  /* T3 — from the family graph */
  if(!window.FAMILY) return null;
  const kinds=[['spouses','Who was married to'],['father','Who was the father of'],['mother','Who was the mother of']];
  for(let k=0;k<25;k++){
    const p=pick(subjPool()); if(!p) return null; const rec=FAMILY.rel[p.id]; if(!rec) continue;
    const [kind,phr]=pick(kinds);
    const rel = kind==='spouses' ? (rec.spouses&&rec.spouses.length?pick(rec.spouses):null) : rec[kind];
    const right=relName(rel); if(!right) continue;
    if(/النبي|Prophet/.test(right)) continue;      /* the ﷺ option would be a giveaway */
    if(tokOverlap(right,p.name)) continue;           /* no patronymic giveaways */
    /* distractors: same-kind relatives of other people */
    const wrong=[]; const seen=new Set([strip(right)]);
    for(const [oid,orec] of shuffle(Object.entries(FAMILY.rel))){
      if(oid===p.id) continue;
      const c = kind==='spouses' ? (orec.spouses&&orec.spouses[0]) : orec[kind];
      const nm=relName(c);
      if(!nm||seen.has(strip(nm))||tokOverlap(nm,p.name)||/النبي|Prophet/.test(nm)) continue;
      wrong.push(nm); seen.add(strip(nm));
      if(wrong.length>=3) break;
    }
    if(wrong.length<3) continue;
    const roleAr = kind==='spouses'?'':''; 
    return {subject:p.id, prompt:`${phr} ${p.name}?`, body:'',
            options: shuffle([{label:right,right:true},...wrong.map(w=>({label:w,right:false}))]),
            because:`${p.name} — ${p.who}`};
  }
  return null;
}

/* --- tier 3: the timeline --- */
const EVENTS = DATA.timeline.eras.flatMap((e,i) => e.events.map(ev => ({...ev, era:e.title, eraIdx:i})));
function evYear(ev){ const m=(ev.year||'').match(/(\d{3,4})/); return m?+m[1]:null; }

function qEventOrder(){                              /* T3 */
  const withY = EVENTS.filter(e=>evYear(e));
  for(let k=0;k<20;k++){
    const a = pick(withY), b = pick(withY);
    if(a===b) continue;
    const ya=evYear(a), yb=evYear(b);
    if(Math.abs(ya-yb) < 2) continue;
    const first = ya<yb ? a : b;
    return {subject:null, prompt:'Which came first?', body:'',
            options: shuffle([{label:a.title, right:a===first},{label:b.title, right:b===first}]),
            because:trunc(`${first.title} — ${first.year}${first.ah?` (${first.ah})`:''}. ${first.desc||''}`,300)};
  }
  return null;
}
function qEventWho(){                                /* T3 */
  const pool = EVENTS.filter(e=>(e.people||[]).length);
  for(let k=0;k<20;k++){
    const ev = pick(pool);
    const nm = pick(ev.people);
    const id = findPerson(nm);
    if(!id) continue;
    if(qs().scope==='known' && !S.known[id] && k<14) continue;
    const p = byId[id];
    const inEvent = new Set((ev.people||[]).map(findPerson).filter(Boolean));
    const wrong = shuffle(COMPANIONS.filter(x=>!inEvent.has(x.id))).slice(0,3);
    return {subject:id, prompt:'Who was part of this?', body:`<b>${esc(ev.title)}</b><br>${esc(trunc(ev.desc||'',260))}`,
            options: shuffle([{label:p.name, right:true}, ...wrong.map(x=>({label:x.name, right:false}))]),
            because:`${ev.title} — ${ev.year||''} ${ev.ah||''}`};
  }
  return null;
}
function qEventWhen(){                               /* T3 */
  const pool = EVENTS.filter(e=>e.year && e.desc);
  const ev = pick(pool);
  const wrong = shuffle(pool.filter(e=>e.year!==ev.year)).slice(0,3);
  return {subject:null, prompt:'When did this happen?', body:`<b>${esc(ev.title)}</b><br>${esc(trunc(ev.desc,240))}`,
          options: shuffle([{label:`${ev.year}${ev.ah?` · ${ev.ah}`:''}`, right:true},
                            ...wrong.map(e=>({label:`${e.year}${e.ah?` · ${e.ah}`:''}`, right:false}))]),
          because:`${ev.title} — ${ev.era}`};
}
function qChapter(){                                 /* T3 */
  const pool = COMPANIONS.filter(x=>(x.book_moments||[]).length);
  const p = pick(pool);
  const m = pick(p.book_moments).replace(/^Ch\.\s*\d+:\s*/,'');
  return {subject:p.id, prompt:'Whose moment in the book is this?', body:esc(trunc(m,300)),
          options: shuffle([p, ...others(p,3)]).map(x=>({label:x.name, right:x.id===p.id})),
          because:`${p.name} — ${p.who}`};
}

const GEN = {
  1: [qScene, qScene, qWho, qArabic],
  2: [qCircle, qTitle, qDeath, qBadge, qWho],
  3: [qEventOrder, qEventWho, qEventWhen, qChapter, qFamily, qFamily],
};

function makeQuestion(tier, preferId){
  for(let k=0;k<25;k++){
    const q = pick(GEN[tier])();
    if(!q) continue;
    if(preferId && q.subject && q.subject!==preferId && k<12) continue;
    /* drop duplicate labels, always keeping the correct one */
    const seenL=new Set();
    q.options = q.options.filter(o=>{
      const k=String(o.label).trim().toLowerCase();
      if(seenL.has(k)) return false;
      seenL.add(k); return true;
    });
    if(q.options.length<2) continue;
    if(q.options.filter(o=>o.right).length!==1) continue;
    /* never let the answer sit in the prompt */
    const right = q.options.find(o=>o.right).label;
    if(q.body && right.length>6 && strip(q.body).includes(strip(right))) continue;
    q.tier = tier;
    return q;
  }
  return null;
}

/* ---------- session ---------- */
let SESSION = null;

function startQuiz(tier, mode){
  const queue = mode==='review' ? shuffle(dueIds()) : [];
  SESSION = {tier, mode, n:0, correct:0, streak:0, missed:[], queue, seen:new Set(),
             total: mode==='round' ? 10 : (mode==='review' ? Math.max(1,queue.length) : Infinity)};
  nextQuestion();
}
function nextQuestion(){
  if(SESSION.n >= SESSION.total) return endQuiz();
  const preferId = SESSION.mode==='review' ? SESSION.queue[SESSION.n % Math.max(1,SESSION.queue.length)] : null;
  let q=null;
  for(let t=0;t<30;t++){
    q = makeQuestion(SESSION.tier, preferId);
    if(!q) break;
    const sig = q.subject || strip(q.prompt+(q.body||'').slice(0,60));
    if(!SESSION.seen.has(sig) || t>=24){ SESSION.seen.add(sig); break; }
    q=null;
  }
  if(!q) return endQuiz();
  SESSION.q = q;
  renderQuestion();
}
function answer(i){
  const q = SESSION.q; if(q.done) return;
  q.done = true;
  const right = q.options[i].right;
  SESSION.n++; if(right){ SESSION.correct++; SESSION.streak++; } else { SESSION.streak=0; SESSION.missed.push(q); }
  const st = qs(); st.tier[q.tier].a++; if(right) st.tier[q.tier].c++;
  if(SESSION.streak > (st.best||0)) st.best = SESSION.streak;
  if(q.subject){
    schedule(q.subject, right);
    if(!right && !S.review[q.subject]){ S.review[q.subject]=1; delete S.known[q.subject]; }
  }
  save(); paintMarks();
  renderQuestion(i);
}
function endQuiz(){
  const s = SESSION; SESSION = null;
  const pct = s.n ? Math.round(s.correct/s.n*100) : 0;
  document.getElementById('quiz').innerHTML = `
    <div class="panel">
      <h2>${s.n ? `${s.correct} of ${s.n}` : 'Nothing to ask'}</h2>
      <div class="lead">${s.n ? `${pct}% · Tier ${s.tier} ${TIERS[s.tier-1].name}${s.mode==='endless'?` · best streak ${qs().best}`:''}` : 'No questions were available for that combination.'}</div>
      ${s.missed.length ? `<h4 class="misshead">Worth another look</h4>${
        '<div class="lst">' + s.missed.filter(m=>m.subject).map(m=>`<span class="lnk" data-goto="${m.subject}">${esc(byId[m.subject].name)}</span>`).join('') + '</div>'
      }<div class="mn">These are now flagged in your “still shaky” list.</div>` : (s.n?'<div class="mn">Nothing missed.</div>':'')}
      <div style="margin-top:14px">
        <button class="btn" id="againBtn">Go again</button>
        <button class="btn" id="backBtn">Back to tiers</button>
      </div>
    </div>`;
  document.querySelectorAll('#quiz [data-goto]').forEach(el=>el.addEventListener('click',()=>gotoPerson(el.dataset.goto)));
  document.getElementById('againBtn').addEventListener('click',()=>startQuiz(s.tier, s.mode));
  document.getElementById('backBtn').addEventListener('click', renderQuizHome);
}

function renderQuestion(chosen){
  const q = SESSION.q;
  const shown = SESSION.n + (q.done?0:1);
  const totalTxt = SESSION.total===Infinity ? '' : ` / ${SESSION.total}`;
  document.getElementById('quiz').innerHTML = `
    <div class="qhead">
      <span class="qtier">Tier ${q.tier} · ${TIERS[q.tier-1].name}</span>
      <span class="qcount">${shown}${totalTxt}</span>
      ${SESSION.mode==='endless'?`<span class="qstreak">streak ${SESSION.streak}</span>`:''}
      <button class="qquit" id="quitBtn">End</button>
    </div>
    <div class="panel qcard">
      <div class="qprompt">${esc(q.prompt)}</div>
      ${q.body?`<div class="qbody">${q.body}</div>`:''}
      <div class="qopts">
        ${q.options.map((o,i)=>{
          let cls='qopt';
          if(q.done){ if(o.right) cls+=' right'; else if(i===chosen) cls+=' wrong'; else cls+=' dim'; }
          return `<button class="${cls}" data-i="${i}">${esc(o.label)}</button>`;
        }).join('')}
      </div>
      ${q.done?`<div class="qwhy">${esc(q.because||'')}</div>
        <div style="margin-top:12px"><button class="btn" id="nextBtn">Next →</button>
        ${q.subject?`<button class="btn" data-goto="${q.subject}">Open the entry</button>`:''}</div>`:''}
    </div>`;
  document.getElementById('quitBtn').addEventListener('click', endQuiz);
  if(!q.done) document.querySelectorAll('#quiz .qopt').forEach(b=>b.addEventListener('click',()=>answer(+b.dataset.i)));
  else {
    document.getElementById('nextBtn').addEventListener('click', nextQuestion);
    document.querySelectorAll('#quiz [data-goto]').forEach(el=>el.addEventListener('click',()=>gotoPerson(el.dataset.goto)));
  }
}

/* ---------- quiz home ---------- */
function setScope(sc){ qs().scope=sc; save(); renderQuizHome(); }
function renderQuizHome(){
  const q = qs(); const due = dueIds().length;
  const known = COMPANIONS.filter(p=>S.known[p.id]).length;
  document.getElementById('quiz').innerHTML = `
    <div class="qscope">
      <span class="qscopelbl">Ask me about:</span>
      <button class="chip ${q.scope!=='known'?'active':''}" id="scAll">All companions</button>
      <button class="chip ${q.scope==='known'?'active':''}" id="scKnown" ${known?'':'disabled'}>✓ Known only${known?` (${known})`:''}</button>
    </div>
    ${q.scope==='known'&&known<5?`<div class="mn" style="margin:-6px 0 12px">Only ${known} marked known — distractors still draw on everyone, so questions stay fair.</div>`:''}
    <div class="tiles">
      ${[1,2,3].map(t=>{
        const s=q.tier[t]; const acc = s.a?Math.round(s.c/s.a*100):0;
        return `<div class="tile"><b>${acc}%</b><span>Tier ${t} · ${s.a} asked</span></div>`;
      }).join('')}
      <div class="tile"><b>${due}</b><span>Due for review</span></div>
    </div>
    ${TIERS.map(t=>{
      const open = unlocked(t.n); const s=q.tier[t.n];
      return `<div class="panel tierp ${open?'':'locked'}">
        <h2>Tier ${t.n} — ${t.name}</h2>
        <div class="lead">${t.blurb}</div>
        ${open?'':`<div class="lockmsg">Opens after ${UNLOCK} correct in Tier ${t.n-1} — ${q.tier[t.n-1].c} so far.</div>`}
        <div class="qmodes">
          <button class="btn" data-tier="${t.n}" data-mode="round">Round of 10</button>
          <button class="btn" data-tier="${t.n}" data-mode="endless">Endless</button>
          <button class="btn" data-tier="${t.n}" data-mode="review"${due?'':' disabled'}>Review${due?` (${due})`:''}</button>
        </div>
        ${s.a?`<div class="mn">${s.c} right of ${s.a} asked</div>`:''}
      </div>`;
    }).join('')}
    <div class="panel">
      <h2>How the tiers work</h2>
      <div class="lead">Tier 1 asks you to recognise, Tier 2 to recall, Tier 3 to connect. Each opens once you have ${UNLOCK} right in the one below — but you can practise a locked tier whenever you like.</div>
      <div class="mn">Anything you get wrong is flagged into your “still shaky” list and comes back sooner. Review mode follows that schedule.</div>
    </div>`;
  document.querySelectorAll('#quiz [data-mode]').forEach(b=>b.addEventListener('click',()=>startQuiz(+b.dataset.tier, b.dataset.mode)));
  document.getElementById('scAll').addEventListener('click',()=>setScope('all'));
  const sk=document.getElementById('scKnown'); if(sk&&!sk.disabled) sk.addEventListener('click',()=>setScope('known'));
}
