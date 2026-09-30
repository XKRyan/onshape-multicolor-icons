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
  const directions=['top','right','bottom','left'];
  const defaults={distance:'top',X:'right',Y:'bottom',Z:'left'};
  const assignments=[];
  function permute(prefix,remaining){
    if(!remaining.length){assignments.push(prefix);return;}
    for(const side of remaining)permute([...prefix,side],remaining.filter(s=>s!==side));
  }
  permute([],directions);
  function place(labels,points,viewport,dialog,preferred={}){
    const left=Math.max(8,viewport.left+8),right=Math.min(innerWidth-8,viewport.right-8);
    const top=Math.max(8,viewport.top+8),bottom=Math.min(innerHeight-8,viewport.bottom-8);
    const segments=[[points[0],points[3]],[points[0],points[1]],[points[1],points[2]],[points[2],points[3]]];
    const obstacles=[{x:dialog.left-8,y:dialog.top-8,w:dialog.width+16,h:dialog.height+16},...points.map(p=>({x:p[0]+2,y:p[1]-21,w:24,h:22}))];
    const bounds={left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))};
    const gap=30;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const safe=(r,used=[])=>r.x>=left&&r.y>=top&&r.x+r.w<=right&&r.y+r.h<=bottom&&!obstacles.some(o=>overlap(r,o))&&!used.some(o=>overlap({x:r.x-5,y:r.y-5,w:r.w+10,h:r.h+10},o))&&!segments.some(([a,b])=>hitsLine(r,a,b));
    const mids=labels.map(l=>[(l.a[0]+l.b[0])/2,(l.a[1]+l.b[1])/2]);
    const near=(r,mid)=>(clamp(mid[0],r.x,r.x+r.w)-mid[0])**2+(clamp(mid[1],r.y,r.y+r.h)-mid[1])**2;
    function outside(label,mid,side,shift=0){
      let x=clamp(mid[0]-label.w/2,left,right-label.w),y=clamp(mid[1]-label.h/2,top,bottom-label.h);
      if(side==='top'||side==='bottom'){x=clamp(x+shift,left,right-label.w);y=side==='top'?bounds.top-gap-label.h:bounds.bottom+gap;}
      else{y=clamp(y+shift,top,bottom-label.h);x=side==='left'?bounds.left-gap-label.w:bounds.right+gap;}
      return {x,y,w:label.w,h:label.h};
    }
    const candidates=labels.map((label,i)=>directions.map(side=>outside(label,mids[i],side)));
    function fit(sides){
      if(sides.some(s=>!directions.includes(s))||new Set(sides).size!==labels.length)return null;
      const rows=[];
      for(let i=0;i<labels.length;i++){const row=candidates[i][directions.indexOf(sides[i])];if(!safe(row,rows))return null;rows.push(row);}
      return rows;
    }
    const previous=labels.map(l=>preferred[l.kind]),prior=fit(previous);
    if(prior)return {rows:prior,sides:preferred};
    // Only 24 assignments: keep one box on each side and choose short leaders.
    // Preserve a valid assignment while rotating to avoid arbitrary switching.
    let best=null,bestScore=Infinity,bestSides=null;
    for(const assignment of assignments){
      const sides=assignment.slice(0,labels.length),rows=fit(sides);if(!rows)continue;
      const score=rows.reduce((n,r,i)=>n+near(r,mids[i])+(sides[i]===defaults[labels[i].kind]?0:10),0);
      if(score<bestScore){best=rows;bestScore=score;bestSides=sides;}
    }
    const state=sides=>Object.fromEntries(labels.map((l,i)=>[l.kind,sides[i]]));
    if(best)return {rows:best,sides:state(bestSides)};
    // Near viewport edges, use a bounded set of local positions instead of
    // scanning every screen pixel. Keep boxes clear even when a side is blocked.
    const rows=[],sides=[],used=[];
    for(let i=0;i<labels.length;i++){
      const label=labels[i],mid=mids[i];let chosen=null,chosenSide=null,score=Infinity;
      function consider(r,side){
        const cost=near(r,mid)+(sides.includes(side)?100000:0)+(side===defaults[label.kind]?0:10);
        if(cost<score&&safe(r,used)){chosen=r;chosenSide=side;score=cost;}
      }
      for(const side of directions){
        for(const shift of [0,-36,36,-72,72])consider(outside(label,mid,side,shift),side);
        for(const offset of [30,60,100,160])for(const shift of [0,-40,40,-80,80]){
          const vertical=side==='top'||side==='bottom';
          const x=vertical?mid[0]-label.w/2+shift:side==='left'?mid[0]-offset-label.w:mid[0]+offset;
          const y=vertical?(side==='top'?mid[1]-offset-label.h:mid[1]+offset):mid[1]-label.h/2+shift;
          consider({x,y,w:label.w,h:label.h},side);
        }
      }
      rows.push(chosen);sides.push(chosenSide);if(chosen)used.push(chosen);
    }
    return {rows,sides:state(sides)};
  }
  return {place};
})();
