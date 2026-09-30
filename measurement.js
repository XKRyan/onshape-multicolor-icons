(() => {
  if(window.top!==window)return;
  const config=globalThis.OSVC,request='OSVC_MEASURE_REQUEST_V1',response='OSVC_MEASURE_RESPONSE_V1';
  const ns='http://www.w3.org/2000/svg';
  let enabled=false,revision=0,serial=0,pending=0,key='',panel=null,svg=null,lastReply=0,requested=false,renderSignature='';
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
    .osvc-measure-overlay .osvc-dimension{fill:none;stroke-width:1.5;stroke-dasharray:5 3}
    .osvc-measure-overlay .osvc-leader{fill:none;stroke-width:1}
  `;
  (document.head||document.documentElement).append(style);
  function node(tag,attrs={},text){const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=text;return el;}
  function cleanup(){panel?.remove();svg?.remove();panel=svg=null;key='';renderSignature='';document.documentElement.removeAttribute('data-osvc-measuring');}
  function send(on=enabled){requested=on;pending=++serial;window.postMessage({type:request,requestId:pending,enabled:on,key},location.origin);}
  function apply(value){enabled=config.settings(value).measurement;if(!enabled){cleanup();send(false);}else send();}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.osvcSettings){revision++;apply(changes.osvcSettings.newValue);}});
  const initial=revision;
  chrome.storage.local.get('osvcSettings').then(r=>{if(revision===initial)apply(r.osvcSettings);}).catch(()=>{enabled=false;cleanup();send(false);});
  function controls(dialog){
    if(!panel?.isConnected || !dialog.contains(panel)){panel?.remove();panel=document.createElement('section');panel.id='osvc-measure-controls';panel.setAttribute('aria-label','测量标注');
      panel.innerHTML='<div class="osvc-measure-head"><strong>视图标注</strong><select id="osvc-measure-mode" aria-label="标注的距离"></select></div><div class="osvc-measure-values"></div><p class="osvc-measure-note"></p>';
      const target=dialog.querySelector('.measure-items-container');target?target.before(panel):dialog.append(panel);
      panel.querySelector('select').addEventListener('change',e=>{key=e.target.value;renderSignature='';svg?.replaceChildren();send();});
    }
    if(!svg){svg=node('svg',{class:'osvc-measure-overlay','aria-hidden':'true'});document.body.append(svg);}
    const font=getComputedStyle(dialog);svg.style.fontFamily=font.fontFamily;
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
    const select=panel.querySelector('select');
    const optionsSignature=JSON.stringify(entries.map(e=>[e.key,e.label]));
    if(select.dataset.signature!==optionsSignature){select.replaceChildren();for(const e of entries){const o=document.createElement('option');o.value=e.key;o.textContent=e.label;select.append(o);}select.dataset.signature=optionsSignature;}
    key=data.key||'';select.value=key;select.disabled=!entries.length;
    const values=panel.querySelector('.osvc-measure-values');values.replaceChildren();
    if(selected){for(const item of [{axis:'distance',value:selected.value,unit:selected.unit},...(selected.axes||[])]){const span=document.createElement('span');span.className='osvc-measure-value';span.style.color=colors[item.axis];span.textContent=`${item.axis==='distance'?'距离':'Δ'+item.axis} ${item.value} ${item.unit}`;values.append(span);}}
    const basis=data.basis==='custom'?'所选配合连接器坐标系':'全局坐标系';
    panel.querySelector('.osvc-measure-note').textContent=!data.ready?'当前无法显示视图标注，原生测量仍可使用。':data.loading?'正在更新测量…':!selected?data.hasNativeResults?'当前没有可用的距离标注；原生测量结果见下方。':'选择两个图元以显示距离标注；其他测量见下方原生结果。':!data.projected?`${basis} · 端点暂不可定位，已保留数值。`:`${basis} · 红 X / 绿 Y / 蓝 Z；正负号沿坐标轴，方向随视角变化。`;
    svg.replaceChildren();
    if(!selected || !data.projected || !validProjection(data))return;
    document.documentElement.setAttribute('data-osvc-measuring','true');
    const {points:p,rect:r}=data;
    // Clip lines to the model viewport; no leaders onto toolbar or sidebar.
    const defs=node('defs'),clip=node('clipPath',{id:'osvc-measure-clip'});clip.append(node('rect',{x:r.left,y:r.top,width:r.width,height:r.height}));defs.append(clip);svg.append(defs);
    const lines=node('g',{'clip-path':'url(#osvc-measure-clip)'});svg.append(lines);
    const used=[];const dialogRect=dialog.getBoundingClientRect();
    function annotation(kind,a,b,text){
      const color=colors[kind];
      const d=`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`;
      lines.append(node('path',{class:'osvc-dimension','data-kind':kind,d,stroke:color}));
      const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
      const sizing=node('text',{},text);svg.append(sizing);const width=Math.max(82,sizing.getComputedTextLength()+18),height=26;sizing.remove();
      const offset=kind==='distance'?-34:26;
      const nx=len>2?-dy/len:1,ny=len>2?dx/len:0;
      let x=mid[0]+nx*offset-width/2,y=mid[1]+ny*offset-height/2;
      const left=Math.max(4,r.left+4),right=Math.min(innerWidth-4,r.right-4),top=Math.max(4,r.top+4),bottom=Math.min(innerHeight-4,r.bottom-4);
      x=Math.max(left,Math.min(right-width,x));y=Math.max(top,Math.min(bottom-height,y));
      const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
      const obstacles=[...used,{x:dialogRect.left-5,y:dialogRect.top-5,w:dialogRect.width+10,h:dialogRect.height+10}];
      const original={x,y};
      for(let step=0;step<24&&obstacles.some(o=>intersects({x,y,w:width,h:height},o));step++){
        y=Math.max(top,Math.min(bottom-height,original.y+(step%2?-1:1)*(Math.floor(step/2)+1)*31));
        if(step>12)x=Math.max(left,Math.min(right-width,original.x+(step%2?-1:1)*width));
      }
      used.push({x,y,w:width,h:height});
      lines.append(node('path',{class:'osvc-leader',d:`M ${mid[0]} ${mid[1]} L ${Math.max(x,Math.min(x+width,mid[0]))} ${Math.max(y,Math.min(y+height,mid[1]))}`,stroke:color}));
      const label=node('g',{'data-kind':kind,class:'osvc-measure-label'});
      label.append(node('rect',{x,y,width,height,rx:3,fill:'#fff',stroke:color,'stroke-width':1.2}),node('text',{x:x+9,y:y+18,fill:color},text));svg.append(label);
    }
    annotation('distance',p[0],p[3],`${selected.label} ${selected.value} ${selected.unit}`);
    for(let i=0;i<3;i++){const axis=['X','Y','Z'][i],item=selected.axes?.find(a=>a.axis===axis);if(item)annotation(axis,p[i],p[i+1],`Δ${axis} ${item.value} ${item.unit}`);}
    for(const [i,name] of [[0,'A'],[3,'B']]){lines.append(node('circle',{cx:p[i][0],cy:p[i][1],r:3,fill:'#fff',stroke:colors.distance}),node('text',{x:p[i][0]+7,y:p[i][1]-7,fill:colors.distance},name));}
  }
  function validProjection(data){return data.points?.length===4&&data.points.every(p=>p?.length===2&&p.every(Number.isFinite))&&['left','top','right','bottom','width','height'].every(k=>Number.isFinite(data.rect?.[k]))&&data.rect.width>0&&data.rect.height>0;}
  window.addEventListener('message',e=>{
    if(e.source!==window || e.data?.type!==response || e.data.requestId!==pending || !enabled)return;
    lastReply=Date.now();render(e.data);
  });
  setInterval(()=>{
    if(!enabled || document.hidden)return;
    const open=!!document.querySelector('.measure-details')?.getClientRects().length;
    if(!open){if(panel||svg||requested){cleanup();send(false);}return;}
    if(lastReply && Date.now()-lastReply>1500)render({ready:false});
    send();
  },80);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cleanup();send(false);}else if(enabled)send();});
  window.addEventListener('pagehide',()=>{cleanup();send(false);});
})();
