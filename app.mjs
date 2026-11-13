import { AIRPORTS } from './airports.mjs';
import { FARES, calculateItinerary, fmt } from './logic.mjs';

const STORAGE_KEY = 'flight-miles-tracker-v1';
const el = id => document.getElementById(id);
const esc = val => String(val ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (value, max=10000000) => Math.min(max, Math.max(0, Number(value) || 0));
const pad = n => String(n).padStart(2,'0');
const dateISO = date => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
const parseDate = iso => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? new Date(`${iso}T12:00:00`) : new Date(NaN);
const today = dateISO(new Date());
const todayDate = parseDate(today);
const priorYear = new Date(todayDate); priorYear.setFullYear(priorYear.getFullYear()-1);
const nextYear = new Date(todayDate); nextYear.setFullYear(nextYear.getFullYear()+1);

let roundTrip = false;
let flights = readFlights();
let lastResult = null;
let currentTab = 'calculator';

function readFlights(){
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(validFlight).slice(0,5000) : [];
  } catch { return []; }
}
function validFlight(item){
  return item && typeof item === 'object' && /^(tk|mm)$/.test(item.programme) && /^(planned|flown)$/.test(item.status)
    && /^[A-Z]{3}$/.test(item.origin) && /^[A-Z]{3}$/.test(item.destination)
    && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    && Object.hasOwn(FARES, item.fareClass) && item.tk && item.mm
    && Number.isFinite(Number(item.tk.statusMiles)) && Number.isFinite(Number(item.mm.points));
}
function persist(){
  try{ localStorage.setItem(STORAGE_KEY,JSON.stringify(flights));return true; }
  catch{return false;}
}
function selectedOptions(){
  return {
    origin:el('origin').value.trim().toUpperCase(),
    destination:el('destination').value.trim().toUpperCase(),
    fareClass:el('booking-class').value,
    roundTrip,
    mmMethod:el('mm-method').value,
    mmFareAmount:el('fare-eur').value,
    mmStatus:el('mm-status').checked,
    distanceOverride:el('manual-distance').value,
    categoryOverride:el('route-category').value
  };
}
function setupFareOptions(){
  const fareOrder = ['E','H','K','M','Y','B','Q','T','G','S','V','W','L','U','O','C','D','Z','F','P','A','R','I','J','N','X'];
  const groups = {'Economy':[], 'Business':[], 'Premium Economy':[], 'No credit':[]};
  for (const code of fareOrder){
    const fare = FARES[code]; const cabin = fare ? fare[0] : 'No credit';
    groups[cabin].push(`<option value="${code}">${code} · ${fare ? `${cabin} · ${Math.round(fare[1]*100)}% M&S` : 'Not eligible for miles'}</option>`);
  }
  el('booking-class').innerHTML = Object.entries(groups).map(([name,items])=>`<optgroup label="${name}">${items.join('')}</optgroup>`).join('');
  el('booking-class').value='E';
}
function setupAirports(){
  el('airport-options').innerHTML = Object.values(AIRPORTS).sort((a,b)=>a.code.localeCompare(b.code))
    .map(a=>`<option value="${a.code}" label="${esc(a.city)}, ${a.country}"></option>`).join('');
}
function setTab(name){
  currentTab=name;
  document.querySelectorAll('.tab').forEach(tab=>{
    const active=tab.dataset.tab===name;
    tab.classList.toggle('active',active);
    if(active)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');
  });
  document.querySelectorAll('.tab-panel').forEach(panel=>panel.classList.toggle('hidden',panel.id!==`panel-${name}`));
  if(name==='log')renderLog();
  if(name==='status')renderStatus();
}
function showFeedback(message,isError=false){
  el('save-feedback').textContent=message;
  el('save-feedback').style.color=isError?'#ffafaf':'#70e6c0';
}
function refresh(){
  const opts=selectedOptions();
  const a=AIRPORTS[opts.origin],b=AIRPORTS[opts.destination];
  const originText=a?.city||'Enter IATA code'; const destText=b?.city||'Enter IATA code';
  el('route-names').innerHTML=`<span>${esc(originText)}</span><span>${esc(destText)}</span>`;
  document.querySelectorAll('.preset').forEach(btn=>btn.classList.toggle('selected',btn.dataset.from===opts.origin&&btn.dataset.to===opts.destination));
  el('summary-origin').textContent=opts.origin||'???';
  el('summary-destination').textContent=opts.destination||'???';
  el('summary-origin-name').textContent=a?.city||'Unknown';
  el('summary-dest-name').textContent=b?.city||'Unknown';
  el('fare-field').classList.toggle('hidden',opts.mmMethod!=='fare');
  el('return-date-wrap').classList.toggle('hidden',!roundTrip);
  el('one-way').classList.toggle('active',!roundTrip); el('round-trip').classList.toggle('active',roundTrip);
  el('one-way').setAttribute('aria-pressed',String(!roundTrip)); el('round-trip').setAttribute('aria-pressed',String(roundTrip));
  if(opts.origin===opts.destination){
    lastResult=null; el('calc-error').textContent='Origin and destination must be different airports.';
    el('calc-error').classList.remove('hidden'); el('save-flight').disabled=true; return;
  }
  const result=calculateItinerary(opts); lastResult=result.valid?result:null;
  el('save-flight').disabled=!result.valid;
  el('calc-error').textContent=result.valid?'':result.reason;
  el('calc-error').classList.toggle('hidden',result.valid);
  const cabin=FARES[opts.fareClass]?.[0]||'INELIGIBLE';
  el('summary-cabin').textContent=`${cabin.toUpperCase()} · CLASS ${opts.fareClass}`;
  el('summary-distance').textContent=`${result.valid?fmt(result.distance):'—'} MI · ${roundTrip?'RETURN':'ONE WAY'}`;
  const fields = result.valid ? result : {turkish:{statusMiles:null,awardMiles:null},mm:{awardMiles:null,points:null,qualifyingPoints:null,honPoints:null}};
  el('tk-status').textContent=fmt(fields.turkish.statusMiles);
  el('tk-award').textContent=fmt(fields.turkish.awardMiles);
  el('tk-contribution').textContent=result.valid?`${(100*result.turkish.statusMiles/40000).toFixed(1)}%`:'—';
  el('mm-award').textContent=fields.mm.awardMiles===null?'See note':fmt(fields.mm.awardMiles);
  el('mm-award').style.fontSize=fields.mm.awardMiles===null?'25px':'';
  el('mm-points').textContent=fmt(fields.mm.points);
  el('mm-qual').textContent=fmt(fields.mm.qualifyingPoints);
  el('mm-hon').textContent=fmt(fields.mm.honPoints);
  const note = result.valid ? result.legs.map(leg=>leg.note).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' ') : '';
  el('result-note').innerHTML = `<span class="note-icon">ⓘ</span><p><strong>Compare, then choose:</strong> one flight can only be credited to one loyalty programme. These are estimates, not guaranteed account credits.${note?' '+esc(note):''} ${result.valid&&!result.legs[0].route.hasAirportData?'Custom route: verify distance and geography manually.':''}</p>`;
}
function addFlights(event){
  event.preventDefault();
  if(!lastResult?.valid){showFeedback('Please complete the flight details first.',true);return;}
  const opts=selectedOptions();
  const dep=el('depart-date').value; const ret=el('return-date').value;
  if(!Number.isFinite(parseDate(dep).getTime()) || (roundTrip&&!Number.isFinite(parseDate(ret).getTime()))){showFeedback('Enter a valid date for each leg.',true);return;}
  if(roundTrip&&ret<dep){showFeedback('The return date must be on or after the outbound date.',true);return;}
  if(flights.length>=5000){showFeedback('Log limit reached. Back up your flights before adding more.',true);return;}
  const programme=el('credit-programme').value;
  const status=el('flight-state').value;
  if(status==='flown' && (dep>today||(roundTrip&&ret>today))){showFeedback('A future flight cannot be marked as already flown. Choose Planned.',true);return;}
  const stamped=Date.now().toString(36);
  const records=lastResult.legs.map((leg,i)=>({
    id:`${stamped}-${i}-${Math.random().toString(36).slice(2,8)}`,
    origin:i===0?opts.origin:opts.destination, destination:i===0?opts.destination:opts.origin,
    date:i===0?dep:ret, fareClass:opts.fareClass, cabin:leg.cabin,
    distance:leg.route.distance, programme,status,
    tk:{awardMiles:leg.turkish.awardMiles,statusMiles:leg.turkish.statusMiles},
    mm:{awardMiles:leg.mm.awardMiles,points:leg.mm.points,qualifyingPoints:leg.mm.qualifyingPoints,honPoints:leg.mm.honPoints},
    savedAt:new Date().toISOString()
  }));
  const previousFlights=flights;
  flights=[...records,...flights];
  if(!persist()){flights=previousFlights;showFeedback('Could not save to browser storage. Try freeing space or using Safari without Private Browsing.',true);return;}
  updateCounts(); showFeedback(`${records.length} flight segment${records.length===1?'':'s'} saved to ${programme==='tk'?'Miles&Smiles':'Miles & More'} (${status}).`);
}
function updateCounts(){el('log-count').textContent=String(flights.length);}
function flightSort(a,b){return b.date.localeCompare(a.date) || String(b.savedAt||'').localeCompare(String(a.savedAt||''));}
function renderLog(){
  updateCounts();
  const flown=flights.filter(f=>f.status==='flown'&&f.date<=today);
  const planned=flights.filter(f=>f.status==='planned');
  el('log-summary').innerHTML=[
    ['FLIGHT SEGMENTS',flights.length,'saved here'],
    ['COMPLETED',flown.length,'marked as flown'],
    ['PLANNED',planned.length,'awaiting travel']
  ].map(([title,number,subtitle])=>`<div class="summary-tile"><label>${title}</label><strong>${fmt(number)}</strong><small>${subtitle}</small></div>`).join('');
  if(!flights.length){el('flight-list').innerHTML='<div class="empty-state"><div class="empty-symbol">✈</div><h3>No flights yet</h3><p>Use the calculator to save your next LOT journey.</p></div>';return;}
  el('flight-list').innerHTML=[...flights].sort(flightSort).map(f=>{
    const allocated=f.programme==='tk'?f.tk.statusMiles:f.mm.points;
    const unit=f.programme==='tk'?'Turkish Status Miles':'M&M Points';
    const canMark=f.status==='planned'&&f.date<=today;
    const label=f.status==='flown'?'Flown':'Planned';
    const formattedDate=parseDate(f.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
    return `<div class="flight-row"><div><div class="flight-route">${esc(f.origin)} <span class="arrow">→</span> ${esc(f.destination)} <span style="font-size:10px;color:${f.status==='flown'?'#70e6c0':'#edc682'}">●</span></div><div class="flight-meta">${esc(formattedDate)} · LOT ${esc(f.fareClass)} · ${esc(label)}<br>${esc(f.programme==='tk'?'Miles&Smiles':'Miles & More')} · ${fmt(f.distance)} mi</div></div><div class="flight-right"><div class="flight-points">${fmt(Number(allocated)||0)}</div><small>${unit}</small><div class="flight-actions">${canMark?`<button type="button" data-action="flown" data-id="${esc(f.id)}">Mark flown</button>`:''}<button class="delete" type="button" data-action="delete" data-id="${esc(f.id)}">Delete</button></div></div></div>`;
  }).join('');
}
function renderStatus(){
  const years=[...new Set([todayDate.getFullYear(),...flights.map(f=>Number(f.date.slice(0,4)))] )].filter(n=>Number.isFinite(n)).sort((a,b)=>b-a);
  const select=el('status-year');const previous=select.value;
  select.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');
  if(years.includes(Number(previous))) select.value=previous;
  const yr=select.value;
  const isFlown=f=>f.status==='flown'&&f.date<=today;
  const tkEligible=f=>f.programme==='tk'&&f.date>=dateISO(priorYear)&&f.date<=today;
  const tkEarned=flights.filter(f=>tkEligible(f)&&isFlown(f)).reduce((v,f)=>v+clamp(f.tk.statusMiles),0);
  const tkProjected=flights.filter(f=>f.programme==='tk'&&f.status==='planned'&&f.date>=today&&f.date<=dateISO(nextYear)).reduce((v,f)=>v+clamp(f.tk.statusMiles),0);
  const mmEarned=flights.filter(f=>f.programme==='mm'&&f.date.startsWith(yr)&&isFlown(f));
  const mmProjected=flights.filter(f=>f.programme==='mm'&&f.date.startsWith(yr)&&f.status==='planned');
  const sum=(arr,key)=>arr.reduce((t,f)=>t+clamp(f.mm[key]),0);
  const pts=sum(mmEarned,'points'),qpts=sum(mmEarned,'qualifyingPoints'),hon=sum(mmEarned,'honPoints');
  const mP=sum(mmProjected,'points'),mQ=sum(mmProjected,'qualifyingPoints');
  const prog=(earned,planned,target,colour='')=>`<div class="track"><div class="fill ${colour}" style="width:${Math.min(100,100*(earned+planned)/target)}%"></div></div><div class="progress-caption">${fmt(earned)} earned${planned?` + ${fmt(planned)} planned`:''} · ${fmt(Math.max(0,target-earned-planned))} remaining (projected)</div>`;
  el('status-cards').innerHTML=`<article class="status-card"><span class="programme-label">TURKISH MILES&SMILES</span><h3>Elite · Star Alliance Gold</h3><div class="subline">Qualification uses the preceding 12 months</div><div class="status-block"><div class="progress-header"><span>STATUS MILES</span><strong>${fmt(tkEarned)} / 40,000</strong></div>${prog(tkEarned,tkProjected,40000)}</div><div class="status-block"><div class="progress-header"><span>CLASSIC PLUS THRESHOLD</span><strong>${fmt(tkEarned)} / 25,000</strong></div>${prog(tkEarned,tkProjected,25000)}</div><div class="status-metrics"><div><label>ROLLING 12 MONTHS</label><strong>${fmt(tkEarned)}</strong></div><div><label>FUTURE PLANNED</label><strong>${fmt(tkProjected)}</strong></div></div><p class="hint">Initial qualification thresholds only. Renewal requirements differ; projected total is indicative, as older miles may expire from your 12-month window before planned flights.</p></article>
  <article class="status-card"><span class="programme-label" style="color:#edc682">MILES & MORE · ${esc(yr)}</span><h3>Frequent Traveller / Senator</h3><div class="subline">Two targets must be met within the calendar year</div><div class="status-block"><div class="progress-header"><span>FREQUENT TRAVELLER · POINTS</span><strong>${fmt(pts)} / 650</strong></div>${prog(pts,mP,650,'gold')}<div class="progress-header" style="margin-top:16px"><span>QUALIFYING POINTS</span><strong>${fmt(qpts)} / 325</strong></div>${prog(qpts,mQ,325,'gold')}</div><div class="status-block"><div class="progress-header"><span>SENATOR · POINTS</span><strong>${fmt(pts)} / 2,000</strong></div>${prog(pts,mP,2000,'gold')}<div class="progress-header" style="margin-top:16px"><span>QUALIFYING POINTS</span><strong>${fmt(qpts)} / 1,000</strong></div>${prog(qpts,mQ,1000,'gold')}</div><div class="status-metrics"><div><label>POINTS EARNED</label><strong>${fmt(pts)}</strong></div><div><label>QUALIFYING</label><strong>${fmt(qpts)}</strong></div><div><label>HON CIRCLE</label><strong>${fmt(hon)}</strong></div></div></article>`;
}
function download(name,body,mime){
  const blob=new Blob([body],{type:mime});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);
}
function exportJson(){download('flight-miles-backup.json',JSON.stringify({app:'Flight Miles Tracker',version:1,exportedAt:new Date().toISOString(),flights},null,2),'application/json');}
function exportCsv(){
  const rows=[['Date','Origin','Destination','LOT booking class','Cabin','Distance (miles)','Credited programme','Status','Turkish status miles (comparison)','Turkish award miles (comparison)','Miles & More award miles (comparison)','Miles & More Points (comparison)','Miles & More Qualifying Points (comparison)','Miles & More HON Points (comparison)']];
  for(const f of [...flights].sort(flightSort))rows.push([f.date,f.origin,f.destination,f.fareClass,f.cabin,f.distance,f.programme==='tk'?'Turkish Miles&Smiles':'Miles & More',f.status,f.tk.statusMiles,f.tk.awardMiles,f.mm.awardMiles??'',f.mm.points,f.mm.qualifyingPoints,f.mm.honPoints]);
  const csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n');
  download('flight-miles-log.csv','\ufeff'+csv,'text/csv;charset=utf-8');
}
async function importJson(event){
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>2_000_000)throw new Error('Backup is too large.');
    const contents=JSON.parse(await file.text());
    const incoming=Array.isArray(contents)?contents:contents.flights;
    if(!Array.isArray(incoming)||incoming.length>5000||!incoming.every(validFlight))throw new Error('This is not a valid Flight Miles Tracker backup.');
    if(!confirm(`Import ${incoming.length} segments? Entries with matching IDs are skipped; existing flights are kept.`))return;
    const ids=new Set(flights.map(f=>f.id));let count=0;
    for(const f of incoming){if(!ids.has(f.id)){flights.push(f);ids.add(f.id);count++;}}
    flights=flights.slice(-5000);
    if(!persist())throw new Error('Browser storage could not be updated.');
    renderLog();alert(`${count} flight segments imported.`);
  }catch(err){alert(err.message||'Import failed.');}
  finally{event.target.value='';}
}
function init(){
  setupFareOptions();setupAirports();
  el('depart-date').value=today;
  const nextWeek=new Date(todayDate);nextWeek.setDate(nextWeek.getDate()+7);
  el('return-date').value=dateISO(nextWeek);
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>setTab(btn.dataset.tab)));
  document.querySelectorAll('.preset').forEach(btn=>btn.addEventListener('click',()=>{el('origin').value=btn.dataset.from;el('destination').value=btn.dataset.to;refresh();}));
  el('swap').addEventListener('click',()=>{const from=el('origin').value;el('origin').value=el('destination').value;el('destination').value=from;refresh();});
  el('one-way').addEventListener('click',()=>{roundTrip=false;refresh();});
  el('round-trip').addEventListener('click',()=>{roundTrip=true;refresh();});
  document.querySelectorAll('#flight-form input, #flight-form select').forEach(node=>{
    if(['depart-date','return-date','credit-programme','flight-state'].includes(node.id))return;
    node.addEventListener('input',()=>{if(node.id==='origin'||node.id==='destination')node.value=node.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);refresh();});
    node.addEventListener('change',refresh);
  });
  el('flight-form').addEventListener('submit',addFlights);
  el('flight-list').addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if(!button)return;
    const flight=flights.find(f=>f.id===button.dataset.id);if(!flight)return;
    if(button.dataset.action==='delete'){
      if(!confirm(`Delete ${flight.origin} → ${flight.destination} on ${flight.date}?`))return;
      flights=flights.filter(f=>f.id!==flight.id);
    }else if(button.dataset.action==='flown'){
      if(flight.date>today){alert('Future flights cannot yet be marked as flown.');return;}
      flight.status='flown';
    }
    persist();renderLog();
  });
  el('status-year').addEventListener('change',renderStatus);
  el('export-csv').addEventListener('click',exportCsv);
  el('export-json').addEventListener('click',exportJson);
  el('import-json').addEventListener('change',importJson);
  updateCounts();refresh();
  if('serviceWorker' in navigator && location.protocol==='https:'){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }
}
init();
