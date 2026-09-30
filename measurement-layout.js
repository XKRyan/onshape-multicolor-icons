/* Keep value boxes clear of every measured segment, including projected points. */
globalThis.OSVCMeasureLayout=(()=>{
  const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  function hitsLine(rect,a,b,gap=6){
    let lo=0,hi=1;
    for(let i=0;i<2;i++){
      const min=(i?rect.y:rect.x)-gap,max=min+(i?rect.h:rect.w)+2*gap;
      const d=b[i]-a[i];
      if(Math.abs(d)<1e-9){if(a[i]<min||a[i]>max)return false;continue;}
      const t=(min-a[i])/d,u=(max-a[i])/d;
      lo=Math.max(lo,Math.min(t,u));hi=Math.min(hi,Math.max(t,u));
      if(lo>hi)return false;
    }
    return true;
  }
  function place(labels,points,viewport,dialog,preferred='right'){
    const left=Math.max(8,viewport.left+8),right=Math.min(innerWidth-8,viewport.right-8);
    const top=Math.max(8,viewport.top+8),bottom=Math.min(innerHeight-8,viewport.bottom-8);
    const segments=[[points[0],points[3]],[points[0],points[1]],[points[1],points[2]],[points[2],points[3]]];
    const obstacles=[{x:dialog.left-8,y:dialog.top-8,w:dialog.width+16,h:dialog.height+16},...points.map(p=>({x:p[0]+2,y:p[1]-21,w:24,h:22}))];
    const bounds={left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))};
    const width=Math.max(...labels.map(l=>l.w)),height=labels.reduce((n,l)=>n+l.h,0)+(labels.length-1)*10,gap=42;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const safe=(r,used=[])=>r.x>=left&&r.y>=top&&r.x+r.w<=right&&r.y+r.h<=bottom&&!obstacles.some(o=>overlap(r,o))&&!used.some(o=>overlap({x:r.x-5,y:r.y-5,w:r.w+10,h:r.h+10},o))&&!segments.some(([a,b])=>hitsLine(r,a,b));
    function column(side){
      let x,y;
      if(side==='left'||side==='right'){
        x=side==='left'?bounds.left-gap-width:bounds.right+gap;
        y=clamp((bounds.top+bounds.bottom-height)/2,top,bottom-height);
      }else{
        x=clamp((bounds.left+bounds.right-width)/2,left,right-width);
        y=side==='top'?bounds.top-gap-height:bounds.bottom+gap;
      }
      const rows=[];
      for(const label of labels){const r={x:x+(side==='left'?width-label.w:0),y,w:label.w,h:label.h};if(!safe(r,rows))return null;rows.push(r);y+=label.h+10;}
      return {side,rows};
    }
    for(const side of [...new Set([preferred,'right','left','top','bottom'])]){const c=column(side);if(c)return c;}
    // If a column cannot fit, search individual free locations. Never force a
    // clamped label onto a line; its value remains in the native measure panel.
    const rows=[];
    for(const label of labels){
      const mid=[(label.a[0]+label.b[0])/2,(label.a[1]+label.b[1])/2];
      const used=rows.filter(Boolean);let best=null,bestScore=Infinity;
      for(let y=top;y+label.h<=bottom;y+=34)for(let x=left;x+label.w<=right;x+=32){
        const r={x,y,w:label.w,h:label.h},score=(x+label.w/2-mid[0])**2+(y+label.h/2-mid[1])**2;
        if(score<bestScore&&safe(r,used)){best=r;bestScore=score;}
      }
      rows.push(best);
    }
    return {side:preferred,rows};
  }
  return {place};
})();
