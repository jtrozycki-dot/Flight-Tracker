// Browser-only status snapshots and optional screenshot OCR. No airline login or server.
export const SNAPSHOT_KEY = 'flight-miles-tracker-snapshots-v1';
const METRICS = ['statusMiles', 'awardMiles', 'points', 'qualifyingPoints', 'honPoints'];
const money = n => Number(n || 0).toLocaleString('en-GB');
const $ = id => document.getElementById(id);
const safe = value => String(value ?? '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const getNumber = s => { const n = Number(String(s ?? '').replace(/[\s,.](?=\d{3}(?:\D|$))/g,'').replace(/[,\s]/g,'')); return Number.isFinite(n) && n >= 0 ? Math.min(10000000,Math.round(n)) : 0; };
const getDate = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); };

export function getSnapshots(){
  try { const x = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '{}'); return x && typeof x==='object' ? x : {}; }
  catch { return {}; }
}
export function saveSnapshots(input){
  const current=getSnapshots();
  for(const p of ['tk','mm']) if(input[p]){
    const date=String(input[p].asOf||getDate());
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || date>getDate()) throw Error('Snapshot date must be today or earlier.');
    const next={asOf:date};
    for(const key of METRICS) if(input[p][key]!==undefined && input[p][key]!==null && input[p][key]!=='') next[key]=getNumber(input[p][key]);
    current[p]=next;
  }
  localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(current));
  return current;
}
function readCount(line){
  const matches=String(line).match(/\d{1,3}(?:[ ,.\u00a0]\d{3})+|\d{1,7}/g) || [];
  const values=matches.map(getNumber).filter(n=>n>0 && n<10000000);
  return values.length ? values[0] : null;
}
// OCR extraction is heuristic: only present proposed values, never persist them on recognition.
export function extractBalances(text, programme='auto'){
  const original=String(text||'');
  const lines=original.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const isTk=programme==='tk' || (programme==='auto' && /miles\s*[&+]\s*smiles|turkish\s*airlines|status\s*miles/i.test(original));
  const isMm=programme==='mm' || (programme==='auto' && /miles\s*[&+]\s*more|qualifying\s*points|hon\s*circle|frequent\s*traveller/i.test(original));
  const rules={tk:{statusMiles:/status\s*miles|tier\s*miles/i,awardMiles:/(award|redeemable|available)\s*miles|miles\s*balance/i},mm:{points:/\bpoints\b/i,qualifyingPoints:/qualifying\s*points/i,honPoints:/hon\s*circle\s*points/i,awardMiles:/(award|redeemable)\s*miles|miles\s*balance/i}};
  const output={};
  for(const p of ['tk','mm']){
    if((p==='tk'&&!isTk)||(p==='mm'&&!isMm))continue;
    const found={};
    for(const [key,rx] of Object.entries(rules[p])){
      for(let i=0;i<lines.length;i++){
        const line=lines[i]; if(!rx.test(line))continue;
        if(p==='mm'&&key==='points'&&/qualifying|hon\s*circle/i.test(line))continue;
        const stripped=line.replace(rx,' ');
        let n=readCount(stripped);
        if(n===null && lines[i+1]) n=readCount(lines[i+1]);
        if(n===null && lines[i-1]) n=readCount(lines[i-1]);
        if(n!==null){found[key]=n;break;}
      }
    }
    if(Object.keys(found).length)output[p]=found;
  }
  return output;
}
const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function dateFrom(s){
  let m=String(s).match(/\b(20\d\d)[-/\.](\d\d?)[-/\.](\d\d?)\b/);
  if(m)return `${m[1]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`;
  m=String(s).match(/\b(\d\d?)[./-](\d\d?)[./-](20\d\d)\b/);
  if(m)return `${m[3]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
  m=String(s).match(/\b(\d\d?)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d\d)/i);
  if(m)return `${m[3]}-${String(MONTHS[m[2].toLowerCase().slice(0,3)]).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
  return null;
}
export function extractFlights(text, airports, fares){
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const found=[];const seen=new Set();
  for(let i=0;i<lines.length;i++){
    const sample=lines.slice(i,Math.min(lines.length,i+3)).join(' ');
    const codes=[...sample.toUpperCase().matchAll(/\b[A-Z]{3}\b/g)].map(m=>m[0]).filter(x=>Object.hasOwn(airports,x));
    if(codes.length<2 || codes[0]===codes[1])continue;
    const iso=dateFrom(sample); if(!iso || !Number.isFinite(new Date(iso+'T12:00:00').getTime()))continue;
    const fare=sample.match(/(?:BOOKING\s*CLASS|FARE\s*CLASS|CLASS|RBD)\s*[:#]?\s*([A-Z])\b/i);
    const classCode=fare?.[1]?.toUpperCase();
    const unique=`${codes[0]}-${codes[1]}-${iso}`;
    if(seen.has(unique))continue;
    seen.add(unique);
    found.push({origin:codes[0],destination:codes[1],date:iso,fareClass:classCode&&Object.hasOwn(fares,classCode)?classCode:'',checked:true});
    if(found.length>=30)break;
  }
  return found;
}
function inputMetric(id,label){
  return `<label class="snapshot-field"><span class="field-label">${label}</span><input type="number" min="0" max="10000000" step="1" id="${id}" placeholder="Not entered"></label>`;
}
export function initEnhancements({airports,fares,calculate,addImported,refreshStatus,openStatus}){
  const root=$('panel-status'); const panel=document.createElement('section');
  panel.className='card snapshot-card'; panel.id='snapshot-editor';
  panel.innerHTML=`<div class="snapshot-title"><div><span class="step">START WHERE YOU ARE</span><h3>Your current programme balances</h3><p>Enter balances from your airline accounts. Each balance is a dated snapshot. Only subsequently logged flights are added, preventing double counting.</p></div></div>
    <div class="snapshot-grid">
      <div class="snapshot-group"><h4>Turkish Miles&Smiles</h4><label class="snapshot-field"><span class="field-label">BALANCE DATE</span><input type="date" id="snap-tk-date"></label>${inputMetric('snap-tk-status','Status Miles')}${inputMetric('snap-tk-award','Award Miles')}</div>
      <div class="snapshot-group"><h4>Miles & More</h4><label class="snapshot-field"><span class="field-label">BALANCE DATE</span><input type="date" id="snap-mm-date"></label>${inputMetric('snap-mm-points','Points')}${inputMetric('snap-mm-qual','Qualifying Points')}${inputMetric('snap-mm-hon','HON Circle Points')}${inputMetric('snap-mm-award','Award Miles')}</div>
    </div>
    <button type="button" class="primary-button snapshot-save" id="save-snapshots">Save current balances</button><p id="snapshot-feedback" class="save-feedback" role="status" aria-live="polite"></p>
    <div class="screenshot-panel" id="screenshot-import"><span class="step">IMPORT FROM SCREENSHOTS</span><h3>Scan airline screenshots</h3><p>Select screenshots of your programme balances or flight activity. The first scan downloads an OCR reader. Images are processed on your device, not sent to our server. Review every figure before saving.</p>
      <label class="field-label" for="ocr-programme">SCREENSHOT SOURCE</label><select id="ocr-programme"><option value="auto">Detect automatically</option><option value="tk">Turkish Miles&Smiles</option><option value="mm">Miles & More</option></select>
      <label class="upload-cta" for="ocr-files"><span>＋ Choose screenshots</span><small>PNG or JPG · multiple images supported</small></label><input type="file" id="ocr-files" accept="image/png,image/jpeg,image/webp" multiple hidden>
      <p id="ocr-feedback" role="status" aria-live="polite" class="ocr-feedback"></p><div id="ocr-review" class="hidden">
       <p class="hint">Check the recognised text below, correct it if necessary, then choose Analyse text. Nothing is saved automatically.</p><textarea id="ocr-text" rows="7" aria-label="Recognised text from screenshot" spellcheck="false"></textarea>
       <button type="button" class="outline-button" id="ocr-reanalyse">Analyse text</button><div id="ocr-results"></div>
       <button type="button" class="primary-button" id="ocr-use-balances">Use recognised balances in the form above</button>
       <button type="button" class="outline-button" id="ocr-add-flights">Add selected flights to log</button>
      </div>
    </div>`;
  root.insertBefore(panel,$('status-cards'));
  const snapForm={tk:{date:'snap-tk-date',statusMiles:'snap-tk-status',awardMiles:'snap-tk-award'},mm:{date:'snap-mm-date',points:'snap-mm-points',qualifyingPoints:'snap-mm-qual',honPoints:'snap-mm-hon',awardMiles:'snap-mm-award'}};
  const fillForm=()=>{const all=getSnapshots();for(const p of ['tk','mm']){ $(snapForm[p].date).value=all[p]?.asOf||getDate(); for(const [metric,id] of Object.entries(snapForm[p])) if(metric!=='date') $(id).value=all[p]?.[metric]??''; }};
  fillForm();
  $('save-snapshots').addEventListener('click',()=>{
    try{const payload={}; for(const p of ['tk','mm']){
      const field=snapForm[p];const item={asOf:$(field.date).value};let filled=0;
      for(const [metric,id] of Object.entries(field))if(metric!=='date' && $(id).value!==''){item[metric]=Number($(id).value);filled++;}
      if(filled)payload[p]=item;
    }
    if(!Object.keys(payload).length)throw Error('Enter at least one programme balance first.');
    saveSnapshots(payload);$('snapshot-feedback').textContent='Saved. Your tracker now includes these starting balances.';refreshStatus();
    }catch(e){$('snapshot-feedback').textContent=e.message||'Could not save balances.';}
  });
  let proposals={balances:{},flights:[]};
  function review(){
    const source=$('ocr-programme').value;
    proposals={balances:extractBalances($('ocr-text').value,source),flights:extractFlights($('ocr-text').value,airports,fares)};
    const values=Object.entries(proposals.balances).map(([p,fields])=>`<div class="ocr-found"><strong>${p==='tk'?'Miles&Smiles':'Miles & More'}</strong>${Object.entries(fields).map(([key,n])=>`<span>${safe(key)}: <b>${money(n)}</b></span>`).join('')}</div>`).join('');
    const rows=proposals.flights.map((f,i)=>`<label class="ocr-flight"><input type="checkbox" data-ocr-flight="${i}" checked><span>${safe(f.date)} · ${f.origin} → ${f.destination}</span><select data-ocr-class="${i}"><option value="">Select booking class</option>${Object.keys(fares).map(code=>`<option value="${code}" ${code===f.fareClass?'selected':''}>${code}</option>`).join('')}</select></label>`).join('');
    $('ocr-results').innerHTML=`<h4>Suggested balances</h4>${values||'<p class="hint">No reliable balance detected. Enter it manually above or edit the OCR text.</p>'}<h4>Possible flight segments</h4>${rows||'<p class="hint">No full route and date found. Flights require a route, date and booking class.</p>'}`;
    $('ocr-use-balances').disabled=!Object.keys(proposals.balances).length;
    $('ocr-add-flights').disabled=!proposals.flights.length;
  }
  $('ocr-reanalyse').addEventListener('click',review);
  $('ocr-use-balances').addEventListener('click',()=>{
    for(const [p,fields] of Object.entries(proposals.balances))for(const [key,value] of Object.entries(fields)){
      const id=snapForm[p]?.[key];if(id)$(id).value=value;
    }
    $('ocr-feedback').textContent='Recognised balances copied above. Check the values and tap Save current balances.';
    $('snapshot-editor').scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('ocr-add-flights').addEventListener('click',()=>{
    const incoming=[]; const programme=$('ocr-programme').value==='mm'?'mm':'tk';
    for(let i=0;i<proposals.flights.length;i++){
      if(!document.querySelector(`[data-ocr-flight="${i}"]`)?.checked)continue;
      const f=proposals.flights[i];const klass=document.querySelector(`[data-ocr-class="${i}"]`)?.value;
      if(!klass){$('ocr-feedback').textContent='Select a LOT booking class for every checked flight.';return;}
      const itinerary=calculate({origin:f.origin,destination:f.destination,fareClass:klass,roundTrip:false,mmMethod:'class',mmFareAmount:0,mmStatus:false,distanceOverride:'',categoryOverride:'auto'});
      if(!itinerary.valid)continue;
      const leg=itinerary.legs[0]; incoming.push({id:`ocr-${Date.now()}-${i}-${Math.random().toString(36).slice(2,8)}`,origin:f.origin,destination:f.destination,date:f.date,fareClass:klass,cabin:leg.cabin,distance:leg.route.distance,programme,status:f.date>getDate()?'planned':'flown',tk:{awardMiles:leg.turkish.awardMiles,statusMiles:leg.turkish.statusMiles},mm:{awardMiles:leg.mm.awardMiles,points:leg.mm.points,qualifyingPoints:leg.mm.qualifyingPoints,honPoints:leg.mm.honPoints},savedAt:new Date().toISOString()});
    }
    if(!incoming.length){$('ocr-feedback').textContent='No flights selected.';return;}
    const added=addImported(incoming);
    $('ocr-feedback').textContent=`${added} flight segment(s) imported. Screenshot credits are estimated using the selected class, not official posted amounts.`;
  });
  $('ocr-files').addEventListener('change',async event=>{
    const files=[...event.target.files].filter(f=>/^image\/(png|jpeg|webp)$/.test(f.type));event.target.value='';
    if(!files.length)return;
    if(files.length>10||files.some(f=>f.size>10_000_000)){$('ocr-feedback').textContent='Choose up to 10 screenshots, each under 10 MB.';return;}
    $('ocr-feedback').textContent='Loading screenshot reader… First use needs an internet connection.';
    try{
      if(!window.Tesseract){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';s.onload=resolve;s.onerror=()=>reject(Error('OCR library unavailable. Check internet and try again.'));document.head.appendChild(s);});}
      const worker=await window.Tesseract.createWorker('eng',1,{logger:m=>{if(m.status==='recognizing text')$('ocr-feedback').textContent=`Reading screenshots… ${Math.round((m.progress||0)*100)}%`; }});
      const text=[];
      try{for(let i=0;i<files.length;i++){
        $('ocr-feedback').textContent=`Reading screenshot ${i+1} of ${files.length}…`;
        const result=await worker.recognize(files[i]);text.push(`SCREENSHOT ${i+1}\n${result.data.text}`);
      }}finally{await worker.terminate();}
      $('ocr-text').value=text.join('\n\n');$('ocr-review').classList.remove('hidden');review();
      $('ocr-feedback').textContent=`Read ${files.length} screenshot(s). Check the suggestions before saving.`;
    }catch(e){$('ocr-feedback').textContent=e.message||'Could not read screenshots. You can enter balances manually.';}
  });
  const logButton=document.createElement('button');logButton.className='outline-button';logButton.type='button';logButton.textContent='Import screenshots';logButton.addEventListener('click',()=>{openStatus();setTimeout(()=>$('screenshot-import').scrollIntoView({behavior:'smooth',block:'start'}),50);});
  $('export-csv').parentElement.appendChild(logButton);
}
