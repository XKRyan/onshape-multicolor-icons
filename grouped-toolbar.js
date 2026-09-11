(() => {
  const root=document.documentElement;
  let settings=OSVC.settings(), host=null, bar=null, menu=null, activeButton=null, signature='', context='', pending=0, enabled=false, lastResponse=0, revision=0;
  const groups=[['create','实体生成'],['modify','编辑'],['pattern','阵列与变换'],['surface','曲线与曲面'],['reference','基准'],['mates','配合'],['motion','传动关系'],['assembly','装配'],['draw','绘图'],['constraints','尺寸与约束'],['sketch','草图编辑'],['sheet','钣金与框架'],['custom','自定义特征'],['other','其他']];
  const defaultIcons={create:'extrude-button',modify:'fillet-button',pattern:'linear-pattern-button',surface:'boundary-surface-button',reference:'c-plane-button',mates:'fastened',motion:'gear',assembly:'assembly-insert-button',draw:'sketch-line-segment-button',constraints:'sketch-dimension-button',sketch:'sketch-trim-button',sheet:'sheet-metal-start-button',custom:'add-feature-type',other:'menu-button'};
  const historyPrefix='osvcGroupLastIcon_';
  const lastIcons={},historyChanged=new Set();
  let currentGroups=new Map();
  function category(t){
    const k=(t.icon+' '+t.command+' '+t.name+' '+t.label).toLowerCase();
    if(t.custom)return 'custom';
    if(/user_features|company_features|添加自定义特征|add custom features/.test(k))return 'custom';
    if(/sketch-/.test(k)){
      if(/line|rectangle|circle|arc|ellipse|spline|polygon|conic|sketch-point|sketch-text|sketch-image/.test(k))return 'draw';
      if(/dimension|coincident|concentric|parallel|perpendicular|tangent|horizontal|vertical|equal|midpoint|symmetric|fix|constraint/.test(k))return 'constraints';
      return 'sketch';
    }
    if(/extrude|revolve|sweep|loft|thicken|拉伸|旋转(?!配合)|扫掠|放样|加厚/.test(k))return 'create';
    if(/mate.?connector|配合连接器/.test(k))return 'reference';
    if(/mate(?!rial)|fastened|revolute|slider|cylindrical|pin.?slot|planar|ball|width.?mate|配合/.test(k))return 'mates';
    if(/gear|rack.?pinion|screw.?relation|belt.?relation|linear.?relation|传动|齿轮关系|螺旋关系/.test(k))return 'motion';
    if(/sheet.?metal|frame|flange|钣金|框架/.test(k))return 'sheet';
    if(/curve|surface|helix|isocline|曲线|曲面|螺旋线/.test(k))return 'surface';
    if(/plane|axis|mate.?connector|基准|平面|配合连接器/.test(k))return 'reference';
    if(/pattern|mirror|transform|阵列|镜像|变换/.test(k))return 'pattern';
    if(/fillet|chamfer|shell|draft|hole|boolean|split|delete.?face|move.?face|replace.?face|enclose|圆角|倒角|抽壳|拔模|布尔|分割|删除面|移动面/.test(k))return 'modify';
    if(/insert|group|replicate|assembly|explode|插入|分组|装配|爆炸/.test(k))return 'assembly';
    return 'other';
  }
  const style=document.createElement('style');style.textContent=`
    .osvc-group-host .toolset,.osvc-group-host .toolbar-item:has(.toolset):not(:has(.command-search-trigger)) {display:none!important;}
    html[data-osvc-grouped=true] #osToolbar,html[data-osvc-grouped=true] os-vue-custom-toolbar {min-width:0!important;max-width:100%!important;width:100%!important;}
    html[data-osvc-grouped=true] .os-toolbar-container,html[data-osvc-grouped=true] .os-grow:has(>os-vue-custom-toolbar) {min-width:0!important;}
    .osvc-group-host .toolbar {min-width:0!important;}
    .osvc-group-host .command-search-trigger {flex-shrink:0!important;white-space:nowrap!important;}
    .osvc-group-bar {display:flex;align-items:center;gap:3px;min-width:0;max-width:100%;height:36px;flex:1 1 auto;overflow-x:auto;scrollbar-width:thin;box-sizing:border-box;}
    .osvc-group-button {box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:5px;padding:0 6px;width:124px;min-width:124px;height:30px;border:0;border-radius:3px;background:var(--os-icon-button-fill--idle,#eee);color:var(--os-text-primary,#333);font:inherit;white-space:nowrap;cursor:pointer;}
    .osvc-group-button > svg {width:20px;height:20px;flex:0 0 20px;pointer-events:none;}
    .osvc-group-button:hover,.osvc-group-button[aria-expanded=true] {background:var(--os-icon-button-fill--hover-other,#dae6f0);}
    .osvc-group-menu {position:fixed;z-index:2147483000;min-width:195px;max-width:300px;max-height:min(460px,75vh);overflow:auto;padding:5px;background:var(--os-background-primary,#fff);color:var(--os-text-primary,#333);border:1px solid var(--os-outline-secondary,#aaa);border-radius:5px;box-shadow:0 4px 18px #0003;font:inherit;}
    .osvc-group-menu button {display:flex;align-items:center;gap:9px;width:100%;padding:7px 10px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;font:inherit;}
    .osvc-group-menu button:hover,.osvc-group-menu button:focus-visible {background:var(--os-icon-button-fill--hover-other,#dae6f0);outline:0;}
    .osvc-group-menu button:disabled {opacity:.4;cursor:default;}
    .osvc-group-menu svg {width:20px;height:20px;flex:0 0 20px;}
    .osvc-group-menu[data-drawing=true] {display:grid;grid-template-columns:repeat(5,38px);min-width:0;}
    .osvc-group-menu[data-drawing=true] button {padding:7px 9px;}
  `;(document.head||root).append(style);
  // Match the native command label, including locale-specific font fallback.
  function matchFont(target,source){
    const native=getComputedStyle(source);
    for(const property of ['font-family','font-size','font-weight','font-style','line-height','letter-spacing'])target.style.setProperty(property,native.getPropertyValue(property));
  }
  function close(){menu?.remove();menu=null;activeButton?.setAttribute('aria-expanded','false');activeButton=null;}
  function restore(){close();bar?.remove();bar=null;host?.classList.remove('osvc-group-host');host=null;signature='';root.removeAttribute('data-osvc-grouped');}
  function request(){if(!enabled)return;pending++;window.postMessage({type:'OSVC_TOOLBAR_REQUEST_V1',action:'catalog',enabled:true,requestId:pending},location.origin);}
  function icon(t){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('aria-hidden','true');
    if(/^[a-zA-Z0-9_-]+$/.test(t.icon)){const use=document.createElementNS(svg.namespaceURI,'use');use.setAttribute('href','#svg-icon-'+t.icon);svg.append(use);}return svg;
  }
  function availableIcon(name){return typeof name==='string'&&/^[a-zA-Z0-9_-]+$/.test(name)&&!!document.getElementById('svg-icon-'+name);}
  function updateGroupIcons(){
    bar?.querySelectorAll('.osvc-group-button').forEach(button=>{
      const group=button.dataset.group,items=currentGroups.get(group)||[],saved=lastIcons[group];
      const recent=items.find(t=>t.command===saved?.command && availableIcon(t.icon));
      const selected=recent?.icon || (availableIcon(defaultIcons[group])?defaultIcons[group]:items.find(t=>availableIcon(t.icon))?.icon) || 'menu-button';
      const use=button.querySelector('svg use');
      if(use?.getAttribute('href')!=='#svg-icon-'+selected){const picture=icon({icon:selected});button.querySelector(':scope > svg')?.remove();button.prepend(picture);}
      button.title=recent?`${groups.find(([key])=>key===group)[1]} · 上次使用：${recent.label}`:groups.find(([key])=>key===group)[1];
    });
  }
  function remember(group,tool){
    // Each category has its own key, so windows do not overwrite other categories.
    lastIcons[group]={command:tool.command};historyChanged.add(group);updateGroupIcons();
    chrome.storage.local.set({[historyPrefix+group]:lastIcons[group]}).catch(()=>{});
  }
  function open(button,items,drawing){
    if(activeButton===button){close();return;}close();activeButton=button;button.setAttribute('aria-expanded','true');
    menu=document.createElement('div');menu.className='osvc-group-menu';menu.setAttribute('role','menu');menu.dataset.drawing=String(drawing);
    for(const t of items){const item=document.createElement('button');item.type='button';item.setAttribute('role','menuitem');item.disabled=t.disabled;item.title=t.label;item.setAttribute('aria-label',t.label);item.append(icon(t));if(!drawing){const text=document.createElement('span');text.textContent=t.label;item.append(text);}item.onclick=()=>{const key=t.key;remember(button.dataset.group,t);close();window.postMessage({type:'OSVC_TOOLBAR_REQUEST_V1',action:'execute',key,context},location.origin);setTimeout(request,50);};menu.append(item);}
    matchFont(menu,button);document.body.append(menu);const r=button.getBoundingClientRect();menu.style.left=Math.max(4,Math.min(r.left,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(4,Math.min(r.bottom+3,innerHeight-menu.offsetHeight-8))+'px';
    menu.querySelector('button:not(:disabled)')?.focus();
  }
  function render(data){
    const target=document.querySelector('os-vue-custom-toolbar .custom-toolbar:not(.custom-table-selector), .os-element-toolbar .custom-toolbar:not(.custom-table-selector)');
    if(!target || !data.ready || !data.tools?.length){restore();return;}
    // Only replace a recognized, populated native toolbar. Search stays in its original DOM.
    const row=target.querySelector('.toolbar'),source=row?.querySelector('.toolset');
    if(!row || !source){restore();return;}
    const sig=JSON.stringify([data.context,data.tools]);if(signature===sig && bar?.isConnected && host===target){updateGroupIcons();return;}
    close();if(host!==target){restore();host=target;}signature=sig;context=data.context;
    const grouped=new Map(groups.map(([key])=>[key,[]]));for(const t of data.tools)grouped.get(category(t)).push(t);
    currentGroups=grouped;
    if(!bar){bar=document.createElement('div');bar.className='osvc-group-bar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','命令分类');row.prepend(bar);}else bar.replaceChildren();
    for(const [key,label] of groups){const items=grouped.get(key);if(!items.length)continue;const b=document.createElement('button');b.type='button';b.className='osvc-group-button';b.dataset.group=key;const text=document.createElement('span');text.textContent=label+' ▾';b.append(text);b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded','false');b.onclick=()=>open(b,items,key==='draw');bar.append(b);}
    matchFont(bar,source.querySelector('.tool-label')||source);
    updateGroupIcons();
    host.classList.add('osvc-group-host');root.setAttribute('data-osvc-grouped','true');
  }
  window.addEventListener('message',e=>{if(e.source!==window||e.data?.type!=='OSVC_TOOLBAR_RESPONSE_V1'||!enabled||e.data.requestId!==pending)return;lastResponse=Date.now();render(e.data);});
  document.addEventListener('pointerdown',e=>{if(menu&&!menu.contains(e.target)&&!activeButton?.contains(e.target))close();},true);
  document.addEventListener('keydown',e=>{if(!menu)return;if(e.key==='Escape'){const b=activeButton;close();b?.focus();e.preventDefault();}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){const list=[...menu.querySelectorAll('button:not(:disabled)')];const i=list.indexOf(document.activeElement);list[(i+(e.key==='ArrowDown'?1:-1)+list.length)%list.length]?.focus();e.preventDefault();}});
  window.addEventListener('resize',close);document.addEventListener('scroll',e=>{if(menu&&!menu.contains(e.target))close();},true);
  function apply(value){settings=OSVC.settings(value);enabled=settings.labels&&settings.groups;if(enabled)request();else{restore();window.postMessage({type:'OSVC_TOOLBAR_REQUEST_V1',action:'catalog',enabled:false,requestId:++pending},location.origin);}}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.osvcSettings){revision++;apply(changes.osvcSettings.newValue);}});
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local')return;
    for(const [key] of groups)if(changes[historyPrefix+key]){historyChanged.add(key);lastIcons[key]=changes[historyPrefix+key].newValue;}
    updateGroupIcons();
  });
  chrome.storage.local.get(groups.map(([key])=>historyPrefix+key)).then(values=>{
    for(const [key] of groups)if(!historyChanged.has(key))lastIcons[key]=values[historyPrefix+key];
    updateGroupIcons();
  }).catch(()=>{});
  const initial=revision;chrome.storage.local.get('osvcSettings').then(r=>{if(initial===revision)apply(r.osvcSettings);});
  setInterval(()=>{if(!enabled)return;if(lastResponse&&Date.now()-lastResponse>3500)restore();request();},750);
})();
