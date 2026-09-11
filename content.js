(() => {
  const config = globalThis.OSVC;
  const styleId = "osvc-category-colors";
  const root = document.documentElement;
  let current = config.settings();
  let revision = 0;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = config.css();
  document.getElementById(styleId)?.remove();
  (document.head || root).append(style);

  function apply(value) {
    current = config.settings(value);
    root.removeAttribute("data-osvc-tint");
    for (const [key, enabled] of Object.entries(current)) {
      if (current.enabled) root.setAttribute(`data-osvc-${key}`, String(enabled));
      else root.removeAttribute(`data-osvc-${key}`);
    }
  }

  // A settings change wins over a pending initial storage read.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.osvcSettings) {
      revision++;
      apply(changes.osvcSettings.newValue);
    }
  });
  const initialRevision = revision;
  chrome.storage.local.get("osvcSettings").then(result => {
    if (revision === initialRevision) apply(result.osvcSettings);
  }).catch(() => apply({ enabled: false }));

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== "OSVC_STATUS") return;
    const counts = { toolbar: 0, tree: 0 };
    const eligible = { toolbar: 0, tree: 0 };
    document.querySelectorAll(config.allIcons).forEach(icon => {
      if (!icon.getClientRects().length) return;
      for (const [scope, selector] of Object.entries(config.scopes)) {
        if (!icon.parentElement?.closest(selector)) continue;
        counts[scope]++;
        if (!icon.closest(config.blocked)) eligible[scope]++;
      }
    });
    const labels = [...document.querySelectorAll('.osvc-command-label, .osvc-native-label > .tool-label')].filter(el=>el.getClientRects().length).length;
    respond({ counts, eligible, labels, grouped: root.getAttribute('data-osvc-grouped') === 'true', settings: current, version: chrome.runtime.getManifest().version });
  });
})();
