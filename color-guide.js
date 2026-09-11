(() => {
  const base=document.getElementById('base'), spec=document.getElementById('spec'), light=document.getElementById('light');
  const hex=values=>'#'+values.map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('').toUpperCase();
  function update(){
    const rgb=base.value.slice(1).match(/../g).map(x=>parseInt(x,16));
    const factor=.5+.5*Number(light.value)/100;
    const colors={input:hex(rgb),shaded:hex(rgb.map(x=>x*factor)),spec:hex(rgb.map(x=>x*factor+255*Number(spec.value)/100))};
    for(const [key,value] of Object.entries(colors)){document.getElementById(key+'-swatch').style.backgroundColor=value;document.getElementById(key+'-hex').textContent=value;}
    document.getElementById('spec-value').textContent=spec.value+'%';document.getElementById('light-value').textContent=light.value+'%';
  }
  [base,spec,light].forEach(input=>input.addEventListener('input',update));update();
})();
