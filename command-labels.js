/* Optional command names. Native icons, events and drawing canvas remain owned by Onshape. */
(() => {
  const toolbar = '.custom-toolbar:not(.custom-table-selector) .toolbar, os-vue-custom-toolbar, .os-vue-custom-toolbar, .os-element-toolbar, .os-toolbar, .os-mini-toolbar-panel, [role="toolbar"]';
  const buttons = '.tool[command-id], .os-tool-button, button, [role="button"]';
  const excluded = /(?:^|-)sketch-(?:.*-)?(?:line|segment|centerline|rectangle|polygon|circle|arc|ellipse|conic|spline|curve|slot|point|text|image|construction|use|project|intersection|offset|trim|extend|split|mirror|pattern|transform|fillet)(?:-|$)/i;
  const names = {
    'new-sketch':'草图','extrude':'拉伸','revolve':'旋转','sweep':'扫掠','loft':'放样',
    'fillet':'圆角','chamfer':'倒角','hole':'孔','shell':'抽壳','draft':'拔模',
    'boolean-bodies':'布尔','linear-pattern':'线性阵列','circular-pattern':'圆周阵列',
    'mirror':'镜像','transform':'变换','thicken':'加厚','enclose':'封闭','split':'分割',
    'c-plane':'基准面','helix':'螺旋线','delete-part':'删除零件','delete-face':'删除面',
    'move-face':'移动面','replace-face':'替换面','boundary-surface':'边界曲面',
    'sheet-metal-start':'钣金模型','sheet-metal-flange':'法兰','sheet-metal-hem':'折边',
    'fastened':'固定配合','revolute':'旋转配合','slider':'滑块配合','cylindrical':'圆柱配合',
    'pin-slot':'销槽配合','planar':'平面配合','ball':'球配合','parallel':'平行配合',
    'group':'分组','gear':'齿轮关系','rack-pinion':'齿轮齿条','screw':'螺旋关系',
    'sketch-dimension':'尺寸','sketch-coincident':'重合','sketch-concentric':'同心',
    'sketch-parallel':'平行','sketch-perpendicular':'垂直','sketch-tangent':'相切',
    'sketch-horizontal':'水平','sketch-vertical':'竖直','sketch-equal':'相等',
    'sketch-midpoint':'中点','sketch-symmetric':'对称','sketch-fix':'固定'
  };
  let enabled = false, revision = 0, timer;
  const style = document.createElement('style');
  const drawingSelectors = ['line','segment','centerline','rectangle','polygon','circle','arc','ellipse','conic','spline','curve','slot','point','text','image','construction','use','project','intersection','offset','trim','extend','split','mirror','pattern','transform','fillet'].map(token=>`use:is([href*="sketch-"][href*="-${token}"], [*|href*="sketch-"][*|href*="-${token}"])`).join(',');
  style.textContent = `
    .osvc-command-label {font:inherit;margin-inline-start:5px;white-space:nowrap;pointer-events:none;max-width:110px;overflow:hidden;text-overflow:ellipsis;flex-shrink:1;}
    .osvc-labeled-command {display:inline-flex!important;align-items:center!important;justify-content:center;gap:0;width:auto!important;min-width:32px;max-width:none!important;flex-shrink:0!important;padding-inline:5px!important;}
    .osvc-label-inner {display:inline-flex!important;align-items:center!important;width:auto!important;max-width:none!important;}
    .osvc-label-scroll {overflow-x:auto!important;scrollbar-width:thin;min-width:0;max-width:100%;}
    .custom-toolbar .toolbar .osvc-native-label > .tool-label.hide-in-toolbar {display:inline-block!important;flex:0 0 auto;max-width:140px;}
    .custom-toolbar .toolbar .tool.osvc-native-label {display:inline-flex!important;flex-shrink:0;}
    html[data-osvc-native-text=true] .custom-toolbar .toolbar .tool[command-id]:not(:has(${drawingSelectors})) > .tool-label.hide-in-toolbar {display:inline-block!important;flex:0 0 auto;max-width:140px;}
  `;
  (document.head || document.documentElement).append(style);
  function clean(value) {
    if (!value || /\{\{|<[^>]+>/.test(value)) return '';
    return value.split(/\r?\n/)[0].replace(/\s*[（(](?:ctrl|alt|shift|快捷键|[a-z](?:\s*[,，]\s*[a-z])?)[^）)]*[）)]\s*$/i,'').trim();
  }
  function ref(button) {
    const use = button.querySelector('svg use');
    return (use?.getAttribute('href') || use?.getAttribute('xlink:href') || button.querySelector('os-svg')?.getAttribute('icon') || '').replace(/^.*#svg-icon-/,'').replace(/-button$/,'');
  }
  function title(button, key) {
    const native = clean(button.querySelector(':scope > .tool-label')?.textContent);
    if (native) return native;
    for (let el = button, depth = 0; el && depth < 4; el = el.parentElement, depth++) {
      for (const attr of ['aria-label','data-bs-original-title','data-original-title','title','data-tooltip']) {
        const name = clean(el.getAttribute(attr));
        if (name) return name;
      }
      if (el.matches(toolbar)) break;
    }
    return names[key] || '';
  }
  function nativeText(button) {
    const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.parentElement.closest('svg, .osvc-command-label, .initial-text')) continue;
      if (walker.currentNode.textContent.trim()) return true;
    }
    return false;
  }
  function clear(button) {
    button.querySelectorAll('.osvc-command-label').forEach(el => el.remove());
    button.classList.remove('osvc-labeled-command');
    button.classList.remove('osvc-native-label');
    button.querySelectorAll('.osvc-label-inner').forEach(el => el.classList.remove('osvc-label-inner'));
  }
  const observer = new MutationObserver(() => schedule());
  function observe() {observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','data-bs-original-title','data-original-title','data-tooltip','href','xlink:href','icon','class']});}
  function refresh() {
    observer.disconnect();
    try {
      document.querySelectorAll('.osvc-label-scroll').forEach(el=>el.classList.remove('osvc-label-scroll'));
      document.querySelectorAll('.osvc-labeled-command, .osvc-native-label').forEach(button => {
        if (!enabled || !button.closest(toolbar)) clear(button);
      });
      if (!enabled) return;
      document.querySelectorAll(toolbar).forEach(bar => bar.querySelectorAll(buttons).forEach(button => {
        if (button.querySelector(buttons) || button.closest('[role="menu"], .os-context-menu, .os-tool-dropdown, .os-tool-dropdown-menu, .custom-table-selector')) return;
        if (!button.querySelector('svg, os-svg, img, .os-tool-command-icon')) return;
        const key = ref(button), name = title(button,key);
        const drawingName = /^(?:直线|线段|矩形|圆|圆弧|椭圆|样条|多边形|点|Line|Rectangle|Circle|Arc|Spline|Polygon)(?:$|\s|[（(])/i.test(name);
        if (excluded.test(key) || drawingName || !name) {clear(button);return;}
        // Vue already owns a localized label and updates it when tools change.
        // Reveal it with an override rather than replacing or removing Vue nodes.
        if (button.matches('.tool[command-id]') && button.querySelector(':scope > .tool-label')) {
          button.classList.add('osvc-native-label');
          return;
        }
        if (nativeText(button)) {clear(button);return;}
        let label = button.querySelector('.osvc-command-label');
        if (!label) {label=document.createElement('span');label.className='osvc-command-label';label.setAttribute('aria-hidden','true');(button.querySelector('.os-tool-command') || button).append(label);}
        if(label.textContent!==name) label.textContent=name;
        label.title=name;
        button.classList.add('osvc-labeled-command');
        button.querySelector('.os-tool-command')?.classList.add('osvc-label-inner');
      }));
      document.querySelectorAll('os-vue-custom-toolbar, .os-vue-custom-toolbar, [role="toolbar"]').forEach(bar=>{
        // Vue menus are nested here: scrolling this ancestor clips open menus.
        if(bar.querySelector('.osvc-labeled-command') && !bar.querySelector('.osvc-native-label'))bar.classList.add('osvc-label-scroll');
      });
    } finally {observe();}
  }
  // Do not postpone forever while the CAD UI continuously changes classes.
  function schedule() {if(timer)return;timer=setTimeout(()=>{timer=null;refresh();},80);}
  function apply(settings) {enabled=globalThis.OSVC.settings(settings).labels;document.documentElement.setAttribute('data-osvc-native-text',String(enabled));schedule();}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.osvcSettings){revision++;apply(changes.osvcSettings.newValue);}});
  const initial=revision;
  chrome.storage.local.get('osvcSettings').then(result=>{if(initial===revision)apply(result.osvcSettings);}).catch(()=>apply({labels:false}));
  observe();
})();
