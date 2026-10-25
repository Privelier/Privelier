/**
 * Self-contained MapLibre GL JS page for the fallback renderer (Expo Go, which
 * cannot load native map modules, and the web build). Same free OpenFreeMap
 * tiles and the same brand-tinted style as the native map; scene updates
 * arrive as messages and are diffed in-page, so the live vehicle glides
 * between GPS fixes instead of jumping.
 *
 * Messages in:  {kind:'scene', scene} | {kind:'recenter'}
 * Messages out: {type:'ready'|'map'|'error'} | {type:'pin', id}
 */
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { MAP_COLORS } from './mapScene';

// v5 is the last line with a classic <script> (UMD) build; v6 ships ESM only.
const MAPLIBRE_GL_VERSION = '5.24.0';

export function buildWebMapHtml(style: StyleSpecification | string, reduceMotion: boolean): string {
  const c = MAP_COLORS;
  // JSON in a <script> must not be able to close the tag.
  const styleJson = JSON.stringify(style).replace(/</g, '\\u003c');
  return `<!doctype html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@${MAPLIBRE_GL_VERSION}/dist/maplibre-gl.js"></script>
<style>
html,body,#map{margin:0;height:100%;background:#121214}
.pin{font:600 12px -apple-system,Inter,Roboto,sans-serif;color:${c.text};background:${c.surface};border:.5px solid ${c.border};border-radius:999px;padding:7px 12px;max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.pin.active{background:${c.brass};border-color:${c.brass};color:${c.onAccent}}
.veh{width:22px;height:22px;position:relative}
.veh .halo{position:absolute;inset:-14px;border-radius:50%;background:${c.brassSoft};animation:pulse 2.2s ease-out infinite}
.veh .dot{position:absolute;inset:0;border-radius:50%;background:${c.brass};border:3px solid #121214;box-shadow:0 0 0 1px ${c.brass}}
.veh .arrow{position:absolute;left:50%;top:-11px;margin-left:-6px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:9px solid ${c.brass};transform-origin:6px 22px}
.veh.stale .dot{background:${c.stale};box-shadow:0 0 0 1px ${c.stale}}.veh.stale .halo,.veh.stale .arrow{display:none}
.dest{width:34px;height:34px;border-radius:50%;background:${c.surface};border:1.5px solid ${c.brass};display:flex;align-items:center;justify-content:center}
.dest svg{width:16px;height:16px}
@keyframes pulse{0%{transform:scale(.45);opacity:.9}100%{transform:scale(1.25);opacity:0}}
${reduceMotion ? '.veh .halo{animation:none;opacity:.35}' : ''}
.maplibregl-ctrl-attrib{background:rgba(18,18,20,.6)!important;color:#9A968C!important;font-size:10px}.maplibregl-ctrl-attrib a{color:#9A968C!important}
</style></head><body><div id="map"></div><script>
(function(){
var send=function(m){var s=JSON.stringify(m);if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s)}else if(window.parent!==window){window.parent.postMessage({__privelierMap:true,payload:s},'*')}};
if(!window.maplibregl){send({type:'error'});return;}
var REDUCE=${reduceMotion ? 'true' : 'false'};
var map=new maplibregl.Map({container:'map',style:${styleJson},attributionControl:{compact:true},dragRotate:false,pitchWithRotate:false,center:[10.45,51.16],zoom:4});
map.touchZoomRotate.disableRotation();
var ready=false,pending=null,pins={},veh=null,vehEl=null,dest=null,anim=null,fitted=false,scene={};
function line(id){return {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[]}}}
map.on('load',function(){
  map.addSource('route',{type:'geojson',data:line()});
  map.addSource('ahead',{type:'geojson',data:line()});
  map.addLayer({id:'route-base',type:'line',source:'route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'${c.routeBase}','line-width':7}});
  map.addLayer({id:'ahead-glow',type:'line',source:'ahead',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'${c.brass}','line-width':12,'line-opacity':0.18,'line-blur':4}});
  map.addLayer({id:'ahead',type:'line',source:'ahead',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'${c.brass}','line-width':4.5}});
  ready=true;send({type:'ready'});if(pending){apply(pending);pending=null}
});
map.on('error',function(){});
map.on('click',function(e){if(!e.originalEvent||!e.originalEvent.__pin)send({type:'map'})});
function setLine(id,coords){var s=map.getSource(id);if(s)s.setData({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords||[]}})}
function syncPins(list){var seen={};(list||[]).forEach(function(p){seen[p.id]=1;var m=pins[p.id];if(!m){var el=document.createElement('div');el.className='pin';el.setAttribute('role','button');el.addEventListener('click',function(ev){ev.stopPropagation();ev.__pin=1;send({type:'pin',id:p.id})});m=pins[p.id]={marker:new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(p.lngLat).addTo(map),el:el}}m.marker.setLngLat(p.lngLat);m.el.textContent=p.label;m.el.setAttribute('aria-label',p.accessibilityLabel);m.el.className='pin'+(p.active?' active':'');m.el.style.zIndex=p.active?2:1});Object.keys(pins).forEach(function(id){if(!seen[id]){pins[id].marker.remove();delete pins[id]}})}
function syncDest(d){if(!d){if(dest){dest.remove();dest=null}return}if(!dest){var el=document.createElement('div');el.className='dest';el.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="${c.brass}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>';dest=new maplibregl.Marker({element:el}).setLngLat(d).addTo(map)}else dest.setLngLat(d)}
function syncVehicle(v){if(!v){if(veh){veh.remove();veh=null}return}
  if(!veh){vehEl=document.createElement('div');vehEl.className='veh';vehEl.innerHTML='<div class="halo"></div><div class="arrow"></div><div class="dot"></div>';veh=new maplibregl.Marker({element:vehEl}).setLngLat(v.lngLat).addTo(map)}
  vehEl.className='veh'+(v.stale?' stale':'');var arrow=vehEl.querySelector('.arrow');arrow.style.display=v.heading==null?'none':'';if(v.heading!=null)arrow.style.transform='rotate('+v.heading+'deg)';
  var from=veh.getLngLat(),to=v.lngLat;if(anim)cancelAnimationFrame(anim);
  if(REDUCE){veh.setLngLat(to);return}
  var t0=performance.now(),D=900;(function step(now){var k=Math.min(1,(now-t0)/D);k=1-Math.pow(1-k,3);veh.setLngLat([from.lng+(to[0]-from.lng)*k,from.lat+(to[1]-from.lat)*k]);if(k<1)anim=requestAnimationFrame(step)})(t0)}
function points(s){var pts=[];(s.pins||[]).forEach(function(p){pts.push(p.lngLat)});if(s.vehicle)pts.push(s.vehicle.lngLat);if(s.destination)pts.push(s.destination);(s.routeAhead||s.route||[]).forEach(function(p){pts.push(p)});return pts}
function frame(s,animate){var pts=points(s);if(!pts.length)return;if(pts.length===1){map.jumpTo({center:pts[0],zoom:14});return}var b=new maplibregl.LngLatBounds(pts[0],pts[0]);pts.forEach(function(p){b.extend(p)});map.fitBounds(b,{padding:{top:72,bottom:260,left:48,right:48},maxZoom:16,duration:animate&&!REDUCE?700:0})}
function follow(s){if(!s.vehicle)return;var p=map.project(s.vehicle.lngLat),w=map.getContainer().clientWidth,h=map.getContainer().clientHeight;if(p.x<w*.15||p.x>w*.85||p.y<h*.12||p.y>h*.62)frame(s,true)}
function apply(s){scene=s;setLine('route',s.route);setLine('ahead',s.routeAhead);syncPins(s.pins);syncDest(s.destination);syncVehicle(s.vehicle);if(!fitted){frame(s,false);fitted=points(s).length>0}else if(s.camera==='follow')follow(s);else if(s.camera==='fit'&&s.__refit)frame(s,true)}
function onMsg(raw){var m;try{m=typeof raw==='string'?JSON.parse(raw):raw}catch(e){return}if(!m)return;if(m.kind==='scene'){if(ready)apply(m.scene);else pending=m.scene}else if(m.kind==='recenter'){frame(scene,true)}}
window.__privelierMap=onMsg;
window.addEventListener('message',function(e){var d=e.data;if(d&&d.__privelierMapIn)onMsg(d.payload)});
})();
</script></body></html>`;
}
