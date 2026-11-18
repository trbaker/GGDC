// The Great Gift Delivery Challenge — game logic and ArcGIS map interactions
// All city data and scoring run locally in the browser; no ArcGIS account or service token required.
const CITIES = [
{name:'Reykjavík',country:'Iceland',lat:64.1466,lon:-21.9426,clue:'This northern capital sits on an island in the North Atlantic, famous for volcanoes and geothermal energy.',hint:'It is the capital of Iceland.',detail:'Iceland lies along the Mid-Atlantic Ridge.'},
{name:'Toronto',country:'Canada',lat:43.6532,lon:-79.3832,clue:'This Canadian city sits near Lake Ontario and is known for a very tall freestanding tower.',hint:'Look along the northwestern shore of Lake Ontario.',detail:'Toronto is on the north shore of Lake Ontario.'},
{name:'Mexico City',country:'Mexico',lat:19.4326,lon:-99.1332,clue:'This large North American capital sits in a high-elevation basin surrounded by mountains.',hint:'It is the capital of Mexico.',detail:'Mexico City is built in the Basin of Mexico.'},
{name:'New York City',country:'United States',lat:40.7128,lon:-74.0060,clue:'This coastal US city has five boroughs and sits where the Hudson River meets the Atlantic.',hint:'Look near the mouth of the Hudson River.',detail:'New York Harbor is an important Atlantic port.'},
{name:'Lima',country:'Peru',lat:-12.0464,lon:-77.0428,clue:'This South American capital lies on the Pacific coast in a desert despite being close to the equator.',hint:'It is the capital of Peru.',detail:'The cold Humboldt Current helps keep Lima very dry.'},
{name:'Rio de Janeiro',country:'Brazil',lat:-22.9068,lon:-43.1729,clue:'This coastal Brazilian city is known for Sugarloaf Mountain and a giant statue overlooking a bay.',hint:'Find the city on southeastern Brazil’s Atlantic coast.',detail:'Rio de Janeiro lies beside Guanabara Bay.'},
{name:'Buenos Aires',country:'Argentina',lat:-34.6037,lon:-58.3816,clue:'This capital sits beside the Río de la Plata estuary in southern South America.',hint:'It is the capital of Argentina.',detail:'The Río de la Plata forms a broad estuary between Argentina and Uruguay.'},
{name:'London',country:'United Kingdom',lat:51.5074,lon:-0.1278,clue:'This European capital sits along the River Thames, just inland from the North Sea.',hint:'It is the capital of the United Kingdom.',detail:'London developed around crossings of the Thames.'},
{name:'Paris',country:'France',lat:48.8566,lon:2.3522,clue:'This European capital lies on the River Seine and is famous for a tall iron tower.',hint:'It is the capital of France.',detail:'Paris grew around islands in the River Seine.'},
{name:'Rome',country:'Italy',lat:41.9028,lon:12.4964,clue:'An ancient city on the Tiber River, located on a peninsula that stretches into the Mediterranean.',hint:'It is the capital of Italy.',detail:'Rome lies near the western coast of the Italian Peninsula.'},
{name:'Cairo',country:'Egypt',lat:30.0444,lon:31.2357,clue:'This North African capital sits on a great river just south of its Mediterranean delta.',hint:'Look for Egypt’s capital near the Nile Delta.',detail:'Cairo lies beside the Nile River.'},
{name:'Nairobi',country:'Kenya',lat:-1.2921,lon:36.8219,clue:'This East African capital is very close to the equator but sits at high elevation.',hint:'It is the capital of Kenya.',detail:'Nairobi is about 1,800 meters above sea level.'},
{name:'Cape Town',country:'South Africa',lat:-33.9249,lon:18.4241,clue:'This city sits near the southwestern tip of Africa below a famous flat-topped mountain.',hint:'Look for Table Mountain along South Africa’s southwest coast.',detail:'Cape Town lies near the Cape of Good Hope.'},
{name:'Dubai',country:'United Arab Emirates',lat:25.2048,lon:55.2708,clue:'This desert city on the Persian Gulf is known for an exceptionally tall skyscraper.',hint:'Find the United Arab Emirates on the Arabian Peninsula.',detail:'Dubai is located on the coast of the Persian Gulf.'},
{name:'Mumbai',country:'India',lat:19.0760,lon:72.8777,clue:'This huge South Asian port city lies on India’s western coast beside the Arabian Sea.',hint:'Look for a major city on India’s west coast.',detail:'Mumbai occupies a coastal island and surrounding reclaimed land.'},
{name:'Singapore',country:'Singapore',lat:1.3521,lon:103.8198,clue:'This island city-state lies just north of the equator at the southern tip of the Malay Peninsula.',hint:'Find the city-state south of Malaysia.',detail:'Singapore sits beside one of the world’s busiest shipping lanes.'},
{name:'Tokyo',country:'Japan',lat:35.6762,lon:139.6503,clue:'This East Asian capital lies on the Pacific side of an island nation, near Mount Fuji.',hint:'It is the capital of Japan.',detail:'Tokyo lies on the Kantō Plain on Honshu.'},
{name:'Seoul',country:'South Korea',lat:37.5665,lon:126.9780,clue:'This Asian capital sits on the Han River, not far from the border with North Korea.',hint:'It is the capital of South Korea.',detail:'Seoul’s Han River flows west toward the Yellow Sea.'},
{name:'Sydney',country:'Australia',lat:-33.8688,lon:151.2093,clue:'This large coastal Australian city is known for an opera house beside a spectacular harbor.',hint:'Look on Australia’s southeastern Pacific coast.',detail:'Sydney is centered on Port Jackson, also called Sydney Harbour.'},
{name:'Auckland',country:'New Zealand',lat:-36.8485,lon:174.7633,clue:'This city in the southwest Pacific sits between two harbors on a narrow volcanic isthmus.',hint:'Look on New Zealand’s North Island.',detail:'Auckland is surrounded by volcanic cones and coastal waterways.'}
];
const SETTINGS = {easy:{label:'Explorer',radius:850,fuel:68000,time:0,bonus:1},medium:{label:'Navigator',radius:500,fuel:55000,time:600,bonus:1.4},hard:{label:'Ace Pilot',radius:275,fuel:47000,time:420,bonus:1.8}};
const $=id=>document.getElementById(id);let game=null,mapEl=$('worldMap'),GraphicsLayer,Graphic,view=null,routeLayer,placeLayer,guessLayer,ringLayer,aircraftLayer,lastGuess=null,ringsVisible=false,ticker=null,flightPaths=[],flying=false,flightToken=0,planeGraphic=null;
const rad=n=>n*Math.PI/180;
function distance(a,b){const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),x=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return Math.round(6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)));}
// For only five destinations, an exhaustive shortest-route search is cheap (at most 120 orders).
// The plane need not return to London: fuel must cover all five one-way deliveries.
const HOME={lat:51.5074,lon:-0.1278,name:'London',country:'United Kingdom'};
function minimumRoute(start, cities){
 if(!cities.length)return {km:0,order:[]};
 let best=Infinity,bestOrder=[];
 function visit(position, remaining, used, km){
  if(km>=best)return;
  if(!remaining.length){best=km;bestOrder=[...used];return;}
  for(let i=0;i<remaining.length;i++){
   const city=remaining[i];visit(city,remaining.filter((_,j)=>j!==i),[...used,city],km+distance(position,city));
  }
 }
 visit(start,cities,[],0);return {km:best,order:bestOrder};
}
function randomMission(config){
 let best=null,bestKm=Infinity;
 for(let attempt=0;attempt<2000;attempt++){
  const pool=[...CITIES];
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const cities=pool.slice(0,5),km=minimumRoute(HOME,cities).km;
  if(km<bestKm){bestKm=km;best=cities;}
  // Keep a modest route-planning cushion, not a guarantee for every possible order.
  if(km<=config.fuel*.86)return cities.map((city,id)=>({id,city,done:false,hint:false,wrong:0}));
 }
 // The fallback remains feasible even if an unusual group is repeatedly sampled.
 if(bestKm>config.fuel)throw new Error('Unable to generate a feasible delivery route');
 return best.map((city,id)=>({id,city,done:false,hint:false,wrong:0}));
}
function updateStatus(message,type=''){const el=$('feedback');el.textContent=message;el.className='feedback '+type;}
function formatTime(s){return s===null?'∞':`${Math.floor(Math.max(0,s)/60)}:${String(Math.max(0,s)%60).padStart(2,'0')}`;}
function updateStats(){if(!game)return;const done=game.missions.filter(m=>m.done).length;$('delivered').textContent=`${done}/5`;$('score').textContent=game.score.toLocaleString();$('clock').textContent=formatTime(game.seconds);$('fuelLabel').textContent=`${game.fuel.toLocaleString()} km left`;let pct=100*game.fuel/game.config.fuel;$('fuelBar').style.width=`${Math.max(0,pct)}%`;$('fuelTrack').setAttribute('aria-valuenow',Math.round(pct));$('manifestCount').textContent=`${5-done} remaining`;}
function renderList(){if(!game)return;$('missionList').replaceChildren();game.missions.forEach((mission,i)=>{const btn=document.createElement('button');btn.type='button';btn.className=`mission ${game.active===i?'active':''} ${mission.done?'done':''}`;btn.disabled=mission.done;btn.setAttribute('aria-pressed',String(game.active===i&&!mission.done));const num=document.createElement('span');num.className='number';num.textContent=mission.done?'✓':String(i+1);const copy=document.createElement('span');copy.className='mission-copy';const title=document.createElement('strong');title.textContent=mission.done?`${mission.city.name}, ${mission.city.country}`:`Mystery package ${i+1}`;const sm=document.createElement('small');sm.textContent=mission.done?'Delivered ✓':mission===game.missions[game.active]?'Currently selected':'Tap to inspect clue';copy.append(title,sm);btn.append(num,copy);btn.addEventListener('click',()=>selectMission(i));$('missionList').append(btn);});}
function selectMission(i){if(!game||game.ended||flying||game.missions[i].done)return;hideCityCard();game.active=i;const m=game.missions[i];$('destination').textContent=`Package ${i+1}: mystery city`;$('clue').textContent=m.city.clue;$('hintBtn').disabled=m.hint;$('hintBtn').textContent=m.hint?'Hint revealed':'🔎 Reveal a hint (−100 points)';$('hintContent').classList.toggle('hidden',!m.hint);$('hintContent').textContent=m.hint?m.city.hint:'';$('missionInstruction').textContent=`Click the city’s location on the map. A submitted pin must be within ${game.config.radius.toLocaleString()} km of its center. Move your pin by clicking or tapping elsewhere; drag the map to pan, then submit when ready. Pick a different package to save fuel.`;resetGuess();renderList();updateStatus(`Package ${i+1} selected. Place or reposition your pin by clicking the map, then press Submit delivery. No penalty for moving a pin.`);}
// Marker metadata is resolved against our city pool, not a basemap popup.
const CITY_ICONS={'London':'🏰','Reykjavík':'🌋','Toronto':'🏙️','Mexico City':'🏛️','New York City':'🗽','Lima':'🏜️','Rio de Janeiro':'⛰️','Buenos Aires':'💃','Paris':'🗼','Rome':'🏛️','Cairo':'🏜️','Nairobi':'🦒','Cape Town':'⛰️','Dubai':'🏙️','Mumbai':'🚆','Singapore':'🌴','Tokyo':'🗼','Seoul':'🌉','Sydney':'🎭','Auckland':'🌋'};
const CITY_REGIONS={'Iceland':'Europe','Canada':'North America','Mexico':'North America','United States':'North America','Peru':'South America','Brazil':'South America','Argentina':'South America','United Kingdom':'Europe','France':'Europe','Italy':'Europe','Egypt':'Africa','Kenya':'Africa','South Africa':'Africa','United Arab Emirates':'Asia','India':'Asia','Singapore':'Asia','Japan':'Asia','South Korea':'Asia','Australia':'Oceania','New Zealand':'Oceania'};
function hideCityCard(){ $('cityCard').classList.add('hidden'); }
function openCityCard(city){
 const known=CITIES.find(c=>c.name===city.name) || city;
 $('cityCardIcon').textContent=CITY_ICONS[known.name]||'📍';
 $('cityCardTitle').textContent=known.name;
 $('cityCardCountry').textContent=known.country;
 $('cityCardRegion').textContent=CITY_REGIONS[known.country]||'World';
 const lat=`${Math.abs(known.lat).toFixed(2)}° ${known.lat>=0?'N':'S'}`;
 const lon=`${Math.abs(known.lon).toFixed(2)}° ${known.lon>=0?'E':'W'}`;
 $('cityCardCoords').textContent=`${lat}, ${lon}`;
 $('cityCardDetail').textContent=known.detail||'A destination on your worldwide delivery route.';
 $('cityCard').classList.remove('hidden');
 $('closeCityCard').focus({preventScroll:true});
}
$('closeCityCard').addEventListener('click',hideCityCard);
$('cityCard').addEventListener('keydown',e=>{if(e.key==='Escape')hideCityCard();});
function markPlace(city,from){if(!placeLayer||!Graphic)return;placeLayer.add(new Graphic({geometry:{type:'point',longitude:city.lon,latitude:city.lat},symbol:{type:'simple-marker',style:'circle',color:from?[255,203,117,1]:[24,165,125,1],size:from?'15px':'13px',outline:{color:'#ffffff',width:2}},attributes:{cityName:city.name},popupEnabled:false}));}
function updatePlane(){if(!placeLayer||!Graphic||!game)return;placeLayer.removeAll();game.missions.filter(m=>m.done).forEach(m=>markPlace(m.city,false));if(!flying)markPlace(game.position,true);}
// Interpolate on the sphere, so the plane follows the shortest great-circle arc.
function interpolateGlobe(a,b,t){
 const p=rad(a.lat),q=rad(b.lat),l=rad(a.lon),m=rad(b.lon);
 const u=[Math.cos(p)*Math.cos(l),Math.cos(p)*Math.sin(l),Math.sin(p)];
 const v=[Math.cos(q)*Math.cos(m),Math.cos(q)*Math.sin(m),Math.sin(q)];
 const theta=Math.acos(Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1]+u[2]*v[2])));
 const sa=theta<.000001?1-t:Math.sin((1-t)*theta)/Math.sin(theta);
 const sb=theta<.000001?t:Math.sin(t*theta)/Math.sin(theta);
 const x=sa*u[0]+sb*v[0],y=sa*u[1]+sb*v[1],z=sa*u[2]+sb*v[2];
 return {lat:Math.atan2(z,Math.hypot(x,y))*180/Math.PI,lon:Math.atan2(y,x)*180/Math.PI};
}
function showPlane(pos,next){
 if(!aircraftLayer||!Graphic)return;
 const tip=next||pos;const dx=(tip.lon-pos.lon+540)%360-180;
 const bearing=Math.atan2(Math.sin(rad(dx))*Math.cos(rad(tip.lat)),Math.cos(rad(pos.lat))*Math.sin(rad(tip.lat))-Math.sin(rad(pos.lat))*Math.cos(rad(tip.lat))*Math.cos(rad(dx)))*180/Math.PI;
 const geometry={type:'point',longitude:pos.lon,latitude:pos.lat,spatialReference:{wkid:4326}};
 if(!planeGraphic){planeGraphic=new Graphic({geometry,symbol:{type:'text',text:'✈',color:'#063e50',haloColor:'#ffffff',haloSize:2,font:{size:29,weight:'bold'}}});aircraftLayer.add(planeGraphic);}
 else planeGraphic.geometry=geometry;
 // Orientation is updated along the route; an ordinary map pan does not affect the heading.
 planeGraphic.symbol={type:'text',text:'✈',color:'#063e50',haloColor:'#ffffff',haloSize:2,angle:-bearing,font:{size:29,weight:'bold'}};
}
function cancelFlight(){flightToken++;flying=false;planeGraphic=null;aircraftLayer?.removeAll();$('flightBanner').classList.add('hidden');document.querySelector('.map-wrap').classList.remove('flying');$('flightEffect').replaceChildren();}
const reducedMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches||!$('motionToggle').checked;
function flyAircraft(from,to){
 const token=++flightToken;
 flying=true;
 if(reducedMotion()||!aircraftLayer){flying=false;return Promise.resolve(true);}
 document.querySelector('.map-wrap').classList.add('flying');
 $('flightBanner').textContent=`✈️ Flying from ${from.name} to ${to.name}…`;
 $('flightBanner').classList.remove('hidden');
 $('submitGuessBtn').disabled=true;$('ringsBtn').disabled=true;
 const duration=2100;const start=performance.now();
 return new Promise(resolve=>{
  function frame(now){
   if(token!==flightToken){resolve(false);return;}
   const t=Math.min(1,(now-start)/duration);
   const eased=t*t*(3-2*t);const pos=interpolateGlobe(from,to,eased);
   showPlane(pos,interpolateGlobe(from,to,Math.min(1,eased+.008)));
   if(t<1){requestAnimationFrame(frame);return;}
   flying=false;aircraftLayer.removeAll();planeGraphic=null;
   $('flightBanner').classList.add('hidden');document.querySelector('.map-wrap').classList.remove('flying');
   resolve(true);
  }
  requestAnimationFrame(frame);
 });
}
function showArrival(city,points){
 if(reducedMotion()||!view)return;
 const screen=view.toScreen({type:'point',longitude:city.lon,latitude:city.lat,spatialReference:{wkid:4326}});
 if(!screen||!Number.isFinite(screen.x)||!Number.isFinite(screen.y))return;
 const effect=$('flightEffect');
 for(const cls of ['arrival-spark','score-pop']){
  const element=document.createElement('div');element.className=cls;
  element.style.left=screen.x+'px';element.style.top=screen.y+'px';
  if(cls==='score-pop')element.textContent=`📦 +${points} points`;
  effect.appendChild(element);
  element.addEventListener('animationend',()=>element.remove(),{once:true});
 }
}
function showCelebration(){
 if(reducedMotion())return;
 const box=$('celebration');box.replaceChildren();box.classList.remove('hidden');
 const colors=['#58dcd1','#ffcb75','#ff7395','#80a7ff','#8deaab'];
 for(let i=0;i<58;i++){
  const el=document.createElement('span');el.className='confetti';el.style.left=(i*37%100)+'%';el.style.backgroundColor=colors[i%colors.length];el.style.animationDelay=(i%11)*.085+'s';el.style.animationDuration=(2.2+(i%7)*.18)+'s';box.appendChild(el);
 }
 setTimeout(()=>{box.replaceChildren();box.classList.add('hidden');},4400);
}

// Display the student's most recent guess independently of aircraft and completed routes.
function resetGuess(){lastGuess=null;ringsVisible=false;guessLayer?.removeAll();ringLayer?.removeAll();$('ringsBtn').disabled=true;$('submitGuessBtn').disabled=true;$('ringsBtn').setAttribute('aria-pressed','false');$('ringsBtn').textContent='◎ Show distance rings';$('ringsInfo').textContent='Make a guess to place a pin. Optional rings: 500, 1,000 and 1,500 km.';}
function placeGuessPin(point){
 if(!guessLayer||!Graphic)return;
 lastGuess={lat:point.latitude,lon:((point.longitude+180)%360+360)%360-180};
 guessLayer.removeAll();
 guessLayer.add(new Graphic({geometry:{type:'point',longitude:lastGuess.lon,latitude:lastGuess.lat,spatialReference:{wkid:4326}},symbol:{type:'simple-marker',style:'diamond',size:'19px',color:[228,52,73,1],outline:{color:[255,255,255,1],width:2}},attributes:{kind:'Student guess'}}));
 $('ringsBtn').disabled=false;$('submitGuessBtn').disabled=!game||game.ended;
 $('ringsInfo').textContent=ringsVisible?'Rings: 500, 1,000 and 1,500 km from your pin.':'Your red pin marks the latest guess. Show three 500 km interval rings?';
 renderRings();
}
// Calculate true great-circle distance circles on a spherical Earth, rather than
// using screen pixels or Web Mercator map distances (both distort with latitude).
function geodesicCircle(origin,radiusKm){
 const angular=radiusKm/6371,latitude=rad(origin.lat),longitude=rad(origin.lon);
 const points=[];
 for(let i=0;i<=240;i++){
  const bearing=2*Math.PI*i/240;
  const phi=Math.asin(Math.max(-1,Math.min(1,Math.sin(latitude)*Math.cos(angular)+Math.cos(latitude)*Math.sin(angular)*Math.cos(bearing))));
  const lambda=longitude+Math.atan2(Math.sin(bearing)*Math.sin(angular)*Math.cos(latitude),Math.cos(angular)-Math.sin(latitude)*Math.sin(phi));
  const lon=((lambda*180/Math.PI+180)%360+360)%360-180;
  points.push([lon,phi*180/Math.PI]);
 }
 // Break lines at the date line, preventing a line drawn across the whole map.
 const paths=[],current=[points[0]];
 for(let i=1;i<points.length;i++){
  const prev=points[i-1],next=points[i];
  if(Math.abs(next[0]-prev[0])>180){
   const offset=next[0]-prev[0]>180?-360:360;
   const continuedLon=next[0]+offset;
   const bound=offset>0?180:-180;
   const f=(bound-prev[0])/(continuedLon-prev[0]);
   const lat=prev[1]+f*(next[1]-prev[1]);
   current.push([bound,lat]);paths.push([...current]);current.length=0;
   current.push([-bound,lat]);
  }
  current.push(next);
 }
 if(current.length>1)paths.push(current);
 return paths;
}
function renderRings(){
 if(!ringLayer||!Graphic)return;
 ringLayer.removeAll();
 if(!lastGuess||!ringsVisible)return;
 for(const radius of [500,1000,1500]){
  ringLayer.add(new Graphic({geometry:{type:'polyline',paths:geodesicCircle(lastGuess,radius),spatialReference:{wkid:4326}},symbol:{type:'simple-line',color:[211,47,73,.9],width:2,style:'dash'},attributes:{distanceKm:radius},popupTemplate:{title:radius.toLocaleString()+' km from your guess',content:'Great-circle distance from the red pin.'}}));
 }
}
$('ringsBtn').addEventListener('click',()=>{if(!lastGuess)return;ringsVisible=!ringsVisible;$('ringsBtn').setAttribute('aria-pressed',String(ringsVisible));$('ringsBtn').textContent=ringsVisible?'◎ Hide distance rings':'◎ Show distance rings';$('ringsInfo').textContent=ringsVisible?'Rings: 500, 1,000 and 1,500 km from your pin.':'Your red pin marks the latest guess. Show three 500 km interval rings?';renderRings();});
// Draw completed routes from the exact same spherical interpolation used by
// the animated aircraft. Split at ±180° so crossing the date line doesn't
// generate a spurious line across the entire Web Mercator map.
function greatCircleRoutePaths(a,b){
 const steps=Math.max(32,Math.min(720,Math.ceil(distance(a,b)/55)));
 const paths=[];
 let previous=interpolateGlobe(a,b,0);
 let current=[[previous.lon,previous.lat]];
 for(let i=1;i<=steps;i++){
  const t=i/steps;
  const next=interpolateGlobe(a,b,t);
  if(Math.abs(next.lon-previous.lon)>180){
   // Locate the date-line intersection on the SAME great-circle curve.
   // The longitude jumps from positive to negative (or vice versa) here.
   const boundary=previous.lon>0?180:-180;
   let lo=(i-1)/steps,hi=t;
   for(let j=0;j<35;j++){
    const mid=(lo+hi)/2;
    const sample=interpolateGlobe(a,b,mid);
    if((sample.lon>=0)===(previous.lon>=0))lo=mid;else hi=mid;
   }
   const crossing=interpolateGlobe(a,b,(lo+hi)/2);
   current.push([boundary,crossing.lat]);
   if(current.length>1)paths.push(current);
   current=[[-boundary,crossing.lat]];
  }
  current.push([next.lon,next.lat]);
  previous=next;
 }
 if(current.length>1)paths.push(current);
 return paths;
}
function drawRoute(a,b){
 if(!routeLayer||!Graphic)return;
 routeLayer.add(new Graphic({
  geometry:{type:'polyline',paths:greatCircleRoutePaths(a,b),spatialReference:{wkid:4326}},
  symbol:{type:'simple-line',color:[14,116,119,.95],width:3,style:'solid'}
 }));
}
async function submitGuess(){
 if(!game||game.ended||flying||!lastGuess)return;
 const m=game.missions[game.active];if(!m||m.done)return;
 const miss=distance(lastGuess,m.city);
 if(miss>game.config.radius){
  m.wrong++;game.score=Math.max(0,game.score-25);updateStats();
  updateStatus(`Your guess is ${miss.toLocaleString()} km from the destination — ${Math.max(0,miss-game.config.radius).toLocaleString()} km outside the landing zone. Move your pin and try again (−25 points).`,'bad');return;
 }
 const travel=distance(game.position,m.city);
 const others=game.missions.filter(x=>!x.done&&x!==m).map(x=>x.city);
 const minimumAfter=minimumRoute(m.city,others).km;
 const required=travel+minimumAfter;
 if(required>game.fuel){
  updateStatus(`Good location! But delivering this package now would leave too little fuel for the others. This stop + the shortest remaining route needs ${required.toLocaleString()} km; you have ${game.fuel.toLocaleString()} km. Select another package first. No points deducted.`,'bad');return;
 }
 const precision=Math.round(350*(1-miss/game.config.radius));
 const gained=Math.round((500+precision)*game.config.bonus);
 const currentGame=game,from={...game.position};
 // Lock the mission during the flight; cancel cleanly when a new game is started.
 const flightCompleted=await flyAircraft(from,m.city);
 if(!flightCompleted||game!==currentGame||game.ended)return;
 game.score+=gained;game.fuel-=travel;
 drawRoute(from,m.city);game.position={lat:m.city.lat,lon:m.city.lon,name:m.city.name,country:m.city.country};
 m.done=true;updatePlane();showArrival(m.city,gained);const count=game.missions.filter(x=>x.done).length;updateStats();renderList();
 if(count===5){updateStatus(`🎉 Delivered to ${m.city.name}! ${miss.toLocaleString()} km from target · +${gained} points.`,'good');endGame(true);return;}
 const next=game.missions.findIndex(x=>!x.done);
 selectMission(next);
 updateStatus(`🎉 Delivered to ${m.city.name}, ${m.city.country}! Your pin was ${miss.toLocaleString()} km from the city. +${gained} points; ${travel.toLocaleString()} km flown. ${m.city.detail}`,'good');
}
$('submitGuessBtn').addEventListener('click',submitGuess);

function startGame(){hideCityCard();cancelFlight();$('startStatus').textContent='';clearInterval(ticker);const difficulty=document.querySelector('input[name="difficulty"]:checked').value;const config=SETTINGS[difficulty];game={config,missions:randomMission(config),score:0,fuel:config.fuel,seconds:config.time||null,position:{lat:51.5074,lon:-0.1278,name:'London',country:'United Kingdom'},active:0,ended:false};routeLayer?.removeAll();resetGuess();$('startOverlay').classList.add('hidden');$('endOverlay').classList.add('hidden');$('levelPill').textContent=`✈️ ${config.label} · London departure`;updatePlane();updateStats();selectMission(0);if(view){view.goTo({center:[12,18],zoom:2},{animate:false}).catch(()=>{});}else{updateStatus('Mission started! The world map is still loading. If the map remains blank, check your connection or reload.');}if(config.time){ticker=setInterval(()=>{if(!game||game.ended||flying)return;game.seconds--;updateStats();if(game.seconds<=0)endGame(false,'Time is up! Your delivery aircraft must return to base.');},1000);}}
function endGame(won,reason=''){if(!game||game.ended)return;game.ended=true;if(flying)cancelFlight();if(won)showCelebration();clearInterval(ticker);$('endOverlay').classList.remove('hidden');$('endEmoji').textContent=won?'🏆':'🛬';$('endHeading').textContent=won?'All gifts delivered!':'Mission ended';$('endText').textContent=won?`Outstanding navigation! You reached all five cities with ${game.fuel.toLocaleString()} km of fuel left.`:reason||'Try again to improve your delivery strategy.';$('finalScore').textContent=game.score.toLocaleString();$('finalDelivered').textContent=`${game.missions.filter(m=>m.done).length}/5`;}
$('hintBtn').addEventListener('click',()=>{if(!game||game.ended||flying)return;const m=game.missions[game.active];if(!m||m.hint)return;m.hint=true;game.score=Math.max(0,game.score-100);$('hintContent').textContent=m.city.hint;$('hintContent').classList.remove('hidden');$('hintBtn').disabled=true;$('hintBtn').textContent='Hint revealed';updateStats();updateStatus('Hint unlocked. 100 points deducted.');});
$('startBtn').addEventListener('click',startGame);$('playAgainBtn').addEventListener('click',()=>{$('endOverlay').classList.add('hidden');$('startOverlay').classList.remove('hidden');});$('closeEndBtn').addEventListener('click',()=>{$('endOverlay').classList.add('hidden');});$('restartBtn').addEventListener('click',()=>{if(game&&!game.ended&&!confirm('Start a fresh mission? Current progress will be lost.'))return;clearInterval(ticker);cancelFlight();game=null;resetGuess();$('endOverlay').classList.add('hidden');$('startOverlay').classList.remove('hidden');});$('helpBtn').addEventListener('click',()=>{alert('HOW TO PLAY\n\n1. Choose a difficulty and select Begin the mission.\n2. Select a mystery package in the delivery manifest.\n3. Read the geographic clue. Click the map to place a red pin.\n4. Move the pin by clicking or tapping elsewhere. Drag anywhere to pan the map. No penalty for moving it! You may show 500, 1,000 and 1,500 km distance rings.\n5. Press Submit delivery to check your answer. An incorrect submitted guess costs 25 points; the feedback gives the great-circle distance to the city.\n6. Deliver all five packages. You may change delivery order to conserve fuel. The game prevents deliveries that would make the remaining route impossible.\n\nHints cost 100 points. Every mission has at least one fuel-feasible route from London. Successful deliveries animate the aircraft along a great-circle path (you can turn off animation or use reduced-motion settings).');});
// These two named map styles are public Esri web maps. Loading their basemaps
// through a public portal item avoids embedding a private API token in classroom HTML.
const BASEMAP_OPTIONS={
 national:{label:'National Geographic',item:'f33a34de3a294590ab48f246e99958c9'},
 topographic:{label:'Topographic',id:'topo-vector'},
 human:{label:'Human Geography',item:'3582b744bba84668b52a16b0b6942544'},
 imagery:{label:'Satellite Imagery',id:'satellite'},
 gray:{label:'Light Gray Canvas',id:'gray-vector'}
};
let WebMapClass=null, basemapChangeId=0,selectedBasemap='osm';
const basemapCache=new Map();
async function changeBasemap(key){
 if(!view)return;
 const option=BASEMAP_OPTIONS[key];if(!option)return;
 const requestId=++basemapChangeId, selector=$('basemapSelect'), status=$('basemapStatus');
 selector.disabled=true;status.textContent='Loading '+option.label+'…';
 const original=mapEl.map.basemap;
 try{
  let bm=basemapCache.get(key);
  if(!bm){
   if(option.item){
    const webmap=new WebMapClass({portalItem:{id:option.item}});
    await webmap.load();
    bm=webmap.basemap;
   }else{
    const Basemap=await $arcgis.import('@arcgis/core/Basemap.js');
    bm=Basemap.fromId(option.id);
    await bm.load();
   }
   if(!bm)throw new Error('No public basemap was returned');
   basemapCache.set(key,bm);
  }
  if(requestId!==basemapChangeId)return;
  mapEl.map.basemap=bm;
  selectedBasemap=key;
  status.textContent=option.label+' active';
 }catch(err){
  if(requestId!==basemapChangeId)return;
  console.warn('Basemap could not load:',key,err);
  mapEl.map.basemap=original;
  selector.value=selectedBasemap;
  status.textContent='Unavailable. Previous map retained.';
 }finally{if(requestId===basemapChangeId)selector.disabled=false;}
}
$('basemapSelect').addEventListener('change',e=>changeBasemap(e.target.value));
async function loadMap(){try{
 // Load Esri separately, so CDN/network failures cannot prevent the Start button from working.
 await import('https://js.arcgis.com/5.2/');
 if(!window.$arcgis)throw new Error('ArcGIS SDK did not initialize');
 const [GL,G]=await Promise.all([$arcgis.import('@arcgis/core/layers/GraphicsLayer.js'),$arcgis.import('@arcgis/core/Graphic.js')]);GraphicsLayer=GL;Graphic=G;WebMapClass=await $arcgis.import('@arcgis/core/WebMap.js');await mapEl.viewOnReady();view=mapEl.view;view.popupEnabled=false;routeLayer=new GraphicsLayer({title:'Completed delivery routes'});placeLayer=new GraphicsLayer({title:'Delivery stops'});ringLayer=new GraphicsLayer({title:'Guess distance rings',listMode:'hide'});aircraftLayer=new GraphicsLayer({title:'Animated delivery aircraft',listMode:'hide'});guessLayer=new GraphicsLayer({title:'Student guess pin',listMode:'hide'});mapEl.map.addMany([routeLayer,placeLayer,ringLayer,guessLayer,aircraftLayer]);// Click places/repositions a tentative pin; it never scores a guess.
view.on('click',async event=>{
 // Check game-owned delivery markers before treating this click as a guess.
 // ArcGIS default popups remain disabled; map dragging is untouched.
 try{
  const hit=await view.hitTest(event,{include:[placeLayer]});
  const marker=hit.results.find(result=>result.graphic?.layer===placeLayer && result.graphic.attributes?.cityName);
  if(marker){
   const city=CITIES.find(c=>c.name===marker.graphic.attributes.cityName);
   if(city)openCityCard(city);
   return;
  }
 }catch(error){console.warn('Could not inspect city marker:',error);}
 hideCityCard();
 if(!game||game.ended||flying)return;
 const point=view.toMap({x:event.x,y:event.y});
 if(point&&Number.isFinite(point.latitude)&&Number.isFinite(point.longitude)){
  placeGuessPin(point);updateStatus('Pin placed. Drag to pan the map, click to reposition the pin, or show the distance rings before submitting.');
 }
});
// Do not intercept view drag gestures. ArcGIS owns dragging/panning at all times.
// Students reposition their tentative guess by clicking/tapping another point.
// This keeps panning and touch gestures functional even when a pin or rings exist.
$('mapLoading').classList.add('hidden');$('startStatus').textContent='';$('basemapSelect').disabled=false;changeBasemap('national');if(game){updatePlane();updateStatus('World map ready! Click a location to place a guess pin.');}else{updateStatus('Map ready! Pick your difficulty and begin your mission.');}}catch(e){console.error('ArcGIS map initialization failed:',e);$('mapLoading').classList.remove('hidden');$('loadingMessage').textContent='Map failed to load. Check network access to js.arcgis.com, then refresh.';if(!game){$('startStatus').textContent='The map could not load. You can start a mission, but map guesses require ArcGIS connectivity.';}else{updateStatus('The map could not load. Please check your internet connection and refresh.','bad');}}}
loadMap();
