/* Read native measurement endpoints and project them with the current camera.
   The reversible builder wrapper observes results without changing arguments,
   return values, highlights, selection, geometry, or document settings. */
(() => {
  const request='OSVC_MEASURE_REQUEST_V1', response='OSVC_MEASURE_RESPONSE_V1';
  const endpoints=new WeakMap();
  let hook=null;
  const vec=p=>p&&p.length>=3&&Array.from(p).slice(0,3).every(Number.isFinite)?Array.from(p).slice(0,3):null;
  function release(){
    if(hook && hook.owner.appendDistanceMeasurements===hook.wrapper){
      if(hook.descriptor)Object.defineProperty(hook.owner,'appendDistanceMeasurements',hook.descriptor);
      else delete hook.owner.appendDistanceMeasurements;
    }
    hook?.subscription?.unsubscribe();
    hook=null;
  }
  function attach(controller){
    const owner=controller?.model?.measurementGraphics;
    if(!owner || typeof owner.appendDistanceMeasurements!=='function')return false;
    if(hook?.owner===owner)return owner.appendDistanceMeasurements===hook.wrapper;
    release();
    const original=owner.appendDistanceMeasurements;
    const wrapper=function(items,raw,transform,...rest){
      const before=items.length;
      const result=original.call(this,items,raw,transform,...rest);
      // An unsupported measurement is left entirely to Onshape.
      try {
        if(raw.getHasDataForDisplay() && raw.isDistance()){
          const start=vec(raw.getStartPoint()),end=vec(raw.getEndPoint());
          const matrix=transform&&transform.length===16&&Array.from(transform).every(Number.isFinite)?Array.from(transform):null;
          const item=items.slice(before).find(i=>!i.isSecondaryMeasurement && i.name===raw.getMeasurementId() && i.type===raw.getMeasurementType());
          if(start && end && matrix && item)endpoints.set(item,{start,end,matrix,axes:items.slice(before).filter(i=>['DX','DY','DZ'].includes(i.name))});
        }
      } catch { /* Native results remain available when an internal shape changes. */ }
      return result;
    };
    hook={owner,original,wrapper,descriptor:Object.getOwnPropertyDescriptor(owner,'appendDistanceMeasurements'),loading:false};owner.appendDistanceMeasurements=wrapper;
    const state=hook;
    state.subscription=controller.model.getMeasurementChangedObservable?.().subscribe(e=>{state.loading=!!e.isLoading;state.hasSelections=e.hasSelections;});
    // Already-created items have no public endpoint field. Refresh once using
    // the native read-only measurement request, including when opening mid-use.
    controller.updateMeasurements?.();
    return true;
  }
  function documentController(){
    const ng=window.angular;
    const injector=ng?.element?.(document.body).injector() || ng?.element?.(document.documentElement).injector();
    return injector?.get('ElementService')?.getDocumentController?.();
  }
  function label(item){
    return String(item.name??'').slice(0,120);
  }
  function value(item){return String(item.value??'')+String(item.toleranceIndication??'');}
  function unit(item){try{return String(item.getUnitsAbbreviation?.().unit||item.unitName||'').slice(0,20);}catch{return '';}}
  function world(p,m){
    const w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];
    if(!Number.isFinite(w)||Math.abs(w)<1e-12)return null;
    return vec([0,1,2].map(i=>(m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12])/w));
  }
  function project(data,viewer){
    const canvas=viewer?.el||viewer?.$el?.[0];
    const camera=viewer?.getCamera?.();
    const rect=canvas?.getBoundingClientRect?.();
    if(!rect || rect.width<=0 || rect.height<=0 || !camera?.projectWorldPointToCanvas)return null;
    const width=camera.getCanvasWidth(),height=camera.getCanvasHeight();
    if(!(width>0&&height>0))return null;
    const {start:a,end:b,matrix:m}=data;
    const chain=[a,[b[0],a[1],a[2]],[b[0],b[1],a[2]],b];
    const points=chain.map(p=>{
      const wp=world(p,m);if(!wp)return null;
      const screen=camera.projectWorldPointToCanvas(wp);
      if(!screen || !Number.isFinite(screen[0]) || !Number.isFinite(screen[1]))return null;
      if(screen.length>2 && (!Number.isFinite(screen[2]) || screen[2]<-1e-6 || screen[2]>1+1e-6))return null;
      // Native projection already flips Y and includes viewport offsets.
      return [rect.left+screen[0]*rect.width/width,rect.top+screen[1]*rect.height/height];
    });
    if(points.some(p=>!p))return null;
    return {points,rect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height}};
  }
  window.addEventListener('message',event=>{
    if(event.source!==window || event.data?.type!==request)return;
    const msg=event.data;
    const send=data=>window.postMessage({type:response,requestId:msg.requestId,...data},location.origin);
    try {
      const dialog=document.querySelector('.measure-details');
      if(!msg.enabled || !dialog?.getClientRects().length){release();send({ready:false});return;}
      const doc=documentController();
      // The Vue current-context stream is not necessarily a BehaviorSubject.
      // Its visible tab identifies the flat-view context without subscribing.
      const active=dialog.querySelector('.split-toggle-button-active use');
      const flat=String(active?.getAttribute('href')||active?.getAttribute('xlink:href')||'').includes('flattened-part');
      const controller=flat?doc?.getFlatMeasurementAreaController?.():doc?.getMeasurementAreaController?.();
      if(!attach(controller)){release();send({ready:false,reason:'unsupported'});return;}
      const items=controller.model.measurementsForDisplay||[];
      // Respect the user's native measurement-type filter.
      // Match native MeasureDialog's parseInt semantics. Vue removes the value
      // attribute for Show all's null value, so option.value can be localized
      // text (e.g. 全部显示), not an empty string or the literal "null".
      const filter=Number.parseInt(dialog.querySelector('.measurement-type-selector')?.value,10);
      const eligible=hook.loading||hook.hasSelections===false?[]:items.filter(i=>endpoints.has(i)&&(Number.isNaN(filter) || i.type===filter));
      const entries=eligible.map(item=>{
        const d=endpoints.get(item);
        const key=String(item.type)+':'+String(item.name);
        return {key,label:label(item),value:value(item),unit:unit(item),axes:d.axes.map(i=>({axis:i.name.slice(1),value:value(i),unit:unit(i)}))};
      });
      const chosen=eligible.find(i=>String(i.type)+':'+String(i.name)===msg.key) || eligible.find(i=>/最小|min/i.test(String(i.name))) || eligible[0];
      const selected=chosen?endpoints.get(chosen):null;
      const projection=selected?project(selected,controller.viewer):null;
      const basis=controller.newOrigin?'custom':'global';
      send({ready:true,entries,key:chosen?String(chosen.type)+':'+String(chosen.name):'',basis,loading:hook.loading,hasNativeResults:hook.hasSelections!==false&&items.length>0,projected:!!projection,...projection});
    } catch {release();send({ready:false,reason:'unsupported'});}
  });
  window.addEventListener('pagehide',release);
})();
