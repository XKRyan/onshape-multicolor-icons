(() => {
  const config = globalThis.OSVC;
  const controls = Object.fromEntries(Object.keys(config.defaults).map(key => [key, document.getElementById(key)]));
  const status = document.getElementById("status");
  let current = config.settings();
  let saveQueue = Promise.resolve();
  function draw() {
    for (const [key, input] of Object.entries(controls)) {
      if(key==='accent')input.value=current.accent;else input.checked = current[key];
      input.disabled = key === 'groups' ? !current.labels : key !== "enabled" && key !== "labels" && !current.enabled;
    }
  }
  function save(persist=true){
    const snapshot={...current};draw();
    document.getElementById('accentHex').value=current.accent;document.getElementById('accentHex').setCustomValidity('');
    const colors=config.colors(current);
    const sample=document.querySelector('.sample svg path:last-child');sample.setAttribute('fill',colors['--os-icon-fill-secondary']);
    document.querySelector('.sample p').textContent='强调色用于面、点和方向，轮廓与留白保持清楚。';
    document.querySelector('.sample svg').setAttribute('aria-label','多色拉伸图标');
    const swatches=document.querySelectorAll('.semantics i');swatches[0].style.setProperty('--color',colors['--os-icon-fill-secondary']);swatches[1].style.setProperty('--color',colors['--os-icon-fill-quaternary']);
    const names=document.querySelectorAll('.semantics b');names[0].textContent='强调色';names[1].textContent='浅色 / 白灰';
    if(!persist){refreshStatus();return;}
    saveQueue=saveQueue.then(()=>chrome.storage.local.set({osvcSettings:snapshot})).then(refreshStatus).catch(()=>{status.textContent='设置未能保存，请重试。';});
  }
  async function refreshStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No tab");
      const reply = await chrome.tabs.sendMessage(tab.id, { type: "OSVC_STATUS" }, { frameId: 0 });
      if (current.labels) {
        status.textContent = !reply.version || reply.version !== chrome.runtime.getManifest().version
          ? "页面还在运行旧版，请刷新 Onshape 文档。"
          : reply.grouped ? "功能分组已生效。命令按类别收起，搜索保留在右侧。"
          : current.groups ? "功能分组暂未接通，已保留原生工具栏。请确认已刷新 Onshape 文档。"
          : reply.labels > 0 ? `命令文字已开启，主页面显示 ${reply.labels} 个名称。`
          : "命令文字已开启，当前未识别到名称。请确认已刷新 Onshape，并进入建模或装配工具栏。";
        return;
      }
      if (!current.enabled) status.textContent = current.labels ? "多色图标已关闭，命令文字保持开启。" : "多色图标和命令文字已关闭，显示 Onshape 原有样式。";
      else if (reply.counts.toolbar + reply.counts.tree === 0) status.textContent = "多色图标已开启。打开建模工具栏查看效果；嵌入页面内的图标单独生效，不计入此处数量。";
      else status.textContent = `主页面已识别工具栏 / 菜单 ${reply.counts.toolbar} 个、特征树 ${reply.counts.tree} 个原生图标。单色符号保留原有线条。`;
    } catch {
      status.textContent = "请打开 cad.onshape.com 中的文档。首次安装后请刷新 Onshape 页面。";
    }
  }
  Object.values(controls).forEach(input => { input.disabled = true; });
  chrome.storage.local.get("osvcSettings").then(result => {
    current = config.settings(result.osvcSettings);
    draw();
    Object.entries(controls).forEach(([key, input]) => input.addEventListener("change", () => {
      current[key] = key==='accent'?input.value:input.checked;
      save();
    }));
    document.getElementById('accentHex').addEventListener('change',e=>{
      const value=e.target.value.trim();if(!/^#[0-9a-f]{6}$/i.test(value)){e.target.setCustomValidity('请输入 # 加六位十六进制色号');e.target.reportValidity();return;}
      e.target.setCustomValidity('');current.accent=value.toLowerCase();save();
    });
    document.getElementById('resetAccent').onclick=()=>{document.getElementById('accentHex').setCustomValidity('');current.accent=config.defaults.accent;save();};
    save(false);
  }).catch(() => { status.textContent = "无法读取设置。请重新打开扩展面板后再试。"; });
})();
