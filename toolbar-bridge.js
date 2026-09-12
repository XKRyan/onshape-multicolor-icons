/* Read the active Onshape command tree; invoke the same dispatcher as its toolbar.
   No toolbar configuration is mutated or saved. Runs in the page's MAIN world. */
(() => {
  const request = 'OSVC_TOOLBAR_REQUEST_V1', response = 'OSVC_TOOLBAR_RESPONSE_V1';
  let catalog = new Map(), context = '', enabled = false;
  function service() {
    const angular = window.angular;
    if (!angular?.element) return null;
    const injector = angular.element(document.body).injector() || angular.element(document.documentElement).injector();
    return injector?.get('ElementToolbarService');
  }
  function snapshot(s) {
    if (!s?.activeToolbar || s.editing || s.isCommandSearchOpen) {catalog.clear();return {ready:false};}
    const disabled = s.getDisabledCommands?.() || {};
    const list = [], seen = new Set();catalog.clear();
    const visit = (node,nativeOnly=false) => {
      if (!node || seen.has(node)) return;seen.add(node);
      nativeOnly=nativeOnly||(node!==s.activeToolbar&&node.draggable===false);
      if (node.isVisibleToUser === false) return;
      if (node.command && !node.children?.length) {
        if (s.shouldShowTool && !s.shouldShowTool(node)) return;
        const key = String(node.key ?? node.id ?? node.command);
        const label = s.$i18next?.t?.(node.name) || node.name || node.command;
        catalog.set(key,node);
        list.push({key,label:String(label),name:String(node.name||''),command:String(node.command),icon:typeof node.icon==='string'?node.icon:'',nativeOnly,custom:!!(node.iconUri||node.img||node.iconInitials),disabled:s.toolbarEnabled===false||!!disabled[node.command]||!!node.disabled});
      }
      for (const child of node.children || []) visit(child,nativeOnly);
      if (node.addTool) visit(node.addTool,nativeOnly);
    };
    visit(s.activeToolbar);
    // HistoryToolset is generated outside activeToolbar and may collapse itself.
    const history=[['UNDO_A_CHANGE','Undo','undo-button'],['REDO_A_CHANGE','Redo','redo-button']].map(([command,name,icon])=>{
      const key='osvc-history-'+command;
      catalog.set(key,{command});
      return {key,command,label:s.$i18next?.t?.(name)||name,icon,disabled:s.toolbarEnabled===false||!!disabled[command]};
    });
    const insert=list.find(t=>t.icon==='assembly-insert-button'||/^(INSERT_ASSEMBLY|ASSEMBLY_INSERT|INSERT)$/.test(t.command));
    if(insert)history.push({...insert,showLabel:true});
    context = String(s.currentContext)+':'+String(s.currentElementId);
    return {ready:list.length>0,context,tools:list,history};
  }
  window.addEventListener('message',event=>{
    if(event.source!==window || event.data?.type!==request)return;
    const msg=event.data;
    try {
      const s=service();
      if(msg.action==='catalog'){
        enabled=msg.enabled===true;
        const data=enabled?snapshot(s):{ready:false};
        if(!enabled)catalog.clear();
        window.postMessage({type:response,requestId:msg.requestId,...data},location.origin);
      } else if(msg.action==='execute' && enabled && s && msg.context===context) {
        // Revalidate the current mode and availability at click time.
        const data=snapshot(s), tool=catalog.get(msg.key);
        const current=[...(data.tools||[]),...(data.history||[])].find(t=>t.key===msg.key);
        if(!tool || !current || current.disabled || data.context!==msg.context)return;
        s.$rootScope.$evalAsync(()=>{
          if(s.toolbarEnabled===false || s.getDisabledCommands?.()[tool.command])return;
          if(tool.namespace)s.executeCommand(tool.namespace,tool.command,tool.commandDetails??undefined);
          else s.executeCommand('',tool.command);
          document.dispatchEvent(new Event('HIDE_TOOLTIP'));
        });
      }
    } catch {window.postMessage({type:response,requestId:msg.requestId,ready:false},location.origin);}
  });
})();
