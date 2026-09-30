(() => {
  if(window.top!==window)return;
  const config=globalThis.OSVC,request='OSVC_MEASURE_REQUEST_V1',response='OSVC_MEASURE_RESPONSE_V1';
  const ns='http://www.w3.org/2000/svg';
  let enabled=false,revision=0,serial=0,pending=0,key='',panel=null,svg=null,lastReply=0,requested=false,renderSignature='',panelSignature='',sentKey='',lastStamp=-1;
  let graph=null,layoutSides={},layoutKey='';
  const annotations=new Map(),widths=new Map();
  const colors={distance:'#333b44',X:'#c73232',Y:'#217a36',Z:'#2461ce'};
  const style=document.createElement('style');style.id='osvc-measure-style';
  style.textContent=`
    #osvc-measure-controls{margin:6px 8px 10px;padding:9px;border:1px solid #cbd3dc;border-radius:4px;background:#f8fafc;font:inherit;color:inherit}
    #osvc-measure-controls .osvc-measure-head{display:flex;align-items:center;gap:8px;margin-bottom:7px}
    #osvc-measure-controls strong{font-weight:600;white-space:nowrap}
    #osvc-measure-mode{flex:1;min-width:0;font:inherit;color:inherit;border:1px solid #c4ccd6;background:white;border-radius:3px;padding:3px}
    #osvc-measure-controls .osvc-measure-values{display:flex;flex-wrap:wrap;gap:6px}
    #osvc-measure-controls .osvc-measure-value{padding:3px 6px;background:white;border:1px solid #dae0e7;border-radius:3px;font-variant-numeric:tabular-nums}
    #osvc-measure-controls .osvc-measure-note{margin:7px 0 0;color:#606c78;font-size:12px;line-height:1.5}
    .osvc-measure-overlay{position:fixed;inset:0;width:100%;height:100%;z-index:1010;pointer-events:none;overflow:hidden}
    .osvc-measure-overlay text{font-size:13px;font-family:inherit;font-variant-numeric:tabular-nums}
    .osvc-measure-overlay .osvc-dimension{fill:none;stroke-width:2.2;stroke-dasharray:6 4;stroke-linecap:round}
    .osvc-measure-overlay .osvc-leader{fill:none;stroke-width:1.2}
  `;
  (document.head||document.documentElement).append(style);
  function node(tag,attrs={},text){const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=text;return el;}
  function attrs(el,value){for(const [k,v] of Object.entries(value))if(el.getAttribute(k)!==String(v))el.setAttribute(k,String(v));}
  function clearDrawing(){svg?.replaceChildren();graph=null;annotations.clear();}
  function cleanup(){panel?.remove();svg?.remove();panel=svg=null;graph=null;annotations.clear();key='';renderSignature=panelSignature=layoutKey='';document.documentElement.removeAttribute('data-osvc-measuring');}
  function send(on=enabled){if(on!==requested || sentKey!==key || !pending)pending=++serial;requested=on;sentKey=key;window.postMessage({type:request,requestId:pending,enabled:on,key},location.origin);}
  function apply(value){enabled=config.settings(value).measurement;if(!enabled){cleanup();send(false);}else send();}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.osvcSettings){revision++;apply(changes.osvcSettings.newValue);}});
  const initial=revision;
  chrome.storage.local.get('osvcSettings').then(r=>{if(revision===initial)apply(r.osvcSettings);}).catch(()=>{enabled=false;cleanup();send(false);});
  function controls(dialog){
    if(!panel?.isConnected || !dialog.contains(panel)){panel?.remove();panel=document.createElement('section');panel.id='osvc-measure-controls';panel.setAttribute('aria-label','测量标注');
      panel.innerHTML='<div class="osvc-measure-head"><strong>视图标注</strong><select id="osvc-measure-mode" aria-label="标注的距离"></select></div><div class="osvc-measure-values"></div><p class="osvc-measure-note"></p>';
      const target=dialog.querySelector('.measure-items-container');target?target.before(panel):dialog.append(panel);
      panelSignature='';
      panel.querySelector('select').addEventListener('change',e=>{key=e.target.value;renderSignature='';send();});
    }
    if(!svg){svg=node('svg',{class:'osvc-measure-overlay','aria-hidden':'true'});svg.style.fontFamily=getComputedStyle(dialog).fontFamily;document.body.append(svg);}
  }
  function render(data){
    const dialog=document.querySelector('.measure-details');
    if(!dialog?.getClientRects().length){cleanup();return;}
    const bounds=dialog.getBoundingClientRect();
    const signature=JSON.stringify([data.ready,data.entries,data.key,data.basis,data.loading,data.hasNativeResults,data.projected,data.points,data.rect,[bounds.left,bounds.top,bounds.width,bounds.height]]);
    if(signature===renderSignature && panel?.isConnected && dialog.contains(panel) && svg?.isConnected)return;
    renderSignature=signature;
    document.documentElement.removeAttribute('data-osvc-measuring');
    controls(dialog);
    const entries=Array.isArray(data.entries)?data.entries:[],selected=entries.find(e=>e.key===data.key);
    const staticSignature=JSON.stringify([data.ready,entries,data.key,data.basis,data.loading,data.hasNativeResults,data.projected]);
    if(staticSignature!==panelSignature){
    panelSignature=staticSignature;
    const select=panel.querySelector('select');
    const optionsSignature=JSON.stringify(entries.map(e=>[e.key,e.label]));
    if(select.dataset.signature!==optionsSignature){select.replaceChildren();for(const e of entries){const o=document.createElement('option');o.value=e.key;o.textContent=e.label;select.append(o);}select.dataset.signature=optionsSignature;}
    key=data.key||'';select.value=key;select.disabled=!entries.length;
    const values=panel.querySelector('.osvc-measure-values');values.replaceChildren();
    if(selected){for(const item of [{axis:'distance',value:selected.value,unit:selected.unit},...(selected.axes||[])]){const span=document.createElement('span');span.className='osvc-measure-value';span.style.color=colors[item.axis];span.textContent=`${item.axis==='distance'?'距离':'Δ'+item.axis} ${item.value} ${item.unit}`;values.append(span);}}
    const basis=data.basis==='custom'?'所选配合连接器坐标系':'全局坐标系';
    panel.querySelector('.osvc-measure-note').textContent=!data.ready?'当前无法显示视图标注，原生测量仍可使用。':data.loading?'正在更新测量…':!selected?data.hasNativeResults?'当前没有可用的距离标注；原生测量结果见下方。':'选择两个图元以显示距离标注；其他测量见下方原生结果。':!data.projected?`${basis} · 端点暂不可定位，已保留数值。`:`${basis} · 红 X / 绿 Y / 蓝 Z；正负号沿坐标轴，方向随视角变化。`;
    }
    if(!selected || !data.projected || !validProjection(data)){clearDrawing();return;}
    document.documentElement.setAttribute('data-osvc-measuring','true');
    const {points:p,rect:r}=data;
    if(!graph){
      const defs=node('defs'),clip=node('clipPath',{id:'osvc-measure-clip'}),clipRect=node('rect');clip.append(clipRect);defs.append(clip);
      const lines=node('g',{'clip-path':'url(#osvc-measure-clip)'}),labels=node('g');svg.append(defs,lines,labels);
      const markers=[0,3].map((i,j)=>{const dot=node('circle',{r:3,fill:'#fff',stroke:colors.distance}),text=node('text',{fill:colors.distance},j?'B':'A');lines.append(dot,text);return {dot,text};});
      graph={clipRect,lines,labels,markers};
    }
    attrs(graph.clipRect,{x:r.left,y:r.top,width:r.width,height:r.height});
    const specs=[{kind:'distance',a:p[0],b:p[3],text:`${selected.label} ${selected.value} ${selected.unit}`}];
    for(let i=0;i<3;i++){const axis=['X','Y','Z'][i],item=selected.axes?.find(a=>a.axis===axis);if(item)specs.push({kind:axis,a:p[i],b:p[i+1],text:`Δ${axis} ${item.value} ${item.unit}`});}
    for(const [kind,n] of annotations)if(!specs.some(s=>s.kind===kind)){n.path.remove();n.leader.remove();n.label.remove();annotations.delete(kind);}
    for(const spec of specs){
      let n=annotations.get(spec.kind);const color=colors[spec.kind];
      if(!n){
        const path=node('path',{class:'osvc-dimension','data-kind':spec.kind,stroke:color}),leader=node('path',{class:'osvc-leader',stroke:color});graph.lines.append(path,leader);
        const label=node('g',{'data-kind':spec.kind,class:'osvc-measure-label'}),box=node('rect',{rx:3,fill:'#fff',stroke:color,'stroke-width':1.2}),text=node('text',{fill:color});label.append(box,text);graph.labels.append(label);
        n={path,leader,label,box,text};annotations.set(spec.kind,n);
      }
      if(n.text.textContent!==spec.text)n.text.textContent=spec.text;
      const widthKey=svg.style.fontFamily+':'+spec.text;
      if(!widths.has(widthKey)){if(widths.size>128)widths.clear();attrs(n.label,{display:'inline'});widths.set(widthKey,Math.max(82,n.text.getComputedTextLength()+18));}
      spec.w=widths.get(widthKey);spec.h=26;
      attrs(n.path,{d:`M ${spec.a[0]} ${spec.a[1]} L ${spec.b[0]} ${spec.b[1]}`});
    }
    if(layoutKey!==staticSignature){layoutKey=staticSignature;layoutSides={};}
    const layout=globalThis.OSVCMeasureLayout.place(specs,p,r,bounds,layoutSides);layoutSides=layout.sides;
    specs.forEach((spec,i)=>{
      const n=annotations.get(spec.kind),box=layout.rows[i];
      attrs(n.label,{display:box?'inline':'none'});attrs(n.leader,{display:box?'inline':'none'});if(!box)return;
      attrs(n.box,{x:box.x,y:box.y,width:box.w,height:box.h});attrs(n.text,{x:box.x+9,y:box.y+18});
      const mid=[(spec.a[0]+spec.b[0])/2,(spec.a[1]+spec.b[1])/2];
      const end=[Math.max(box.x,Math.min(box.x+box.w,mid[0])),Math.max(box.y,Math.min(box.y+box.h,mid[1]))];
      attrs(n.leader,{d:`M ${mid[0]} ${mid[1]} L ${end[0]} ${end[1]}`});
    });
    graph.markers.forEach((m,i)=>{const pt=p[i?3:0];attrs(m.dot,{cx:pt[0],cy:pt[1]});attrs(m.text,{x:pt[0]+7,y:pt[1]-7});});
  }
  function validProjection(data){return data.points?.length===4&&data.points.every(p=>p?.length===2&&p.every(Number.isFinite))&&['left','top','right','bottom','width','height'].every(k=>Number.isFinite(data.rect?.[k]))&&data.rect.width>0&&data.rect.height>0;}
  function accept(data){
    if(data?.type!==response || data.requestId!==pending || !enabled || document.hidden)return;
    if(Number.isFinite(data.stamp)){if(data.stamp<lastStamp)return;lastStamp=data.stamp;}
    lastReply=Date.now();render(data);
  }
  window.addEventListener('message',e=>{if(e.source===window)accept(e.data);});
  document.addEventListener('OSVC_MEASURE_FRAME_V1',e=>accept(e.detail));
  setInterval(()=>{
    if(!enabled || document.hidden)return;
    const open=!!document.querySelector('.measure-details')?.getClientRects().length;
    if(!open){if(panel||svg||requested){cleanup();send(false);}return;}
    if(lastReply && Date.now()-lastReply>1500)render({ready:false});
    send();
  },250);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cleanup();send(false);}else if(enabled)send();});
  window.addEventListener('pagehide',()=>{cleanup();send(false);});
})();
