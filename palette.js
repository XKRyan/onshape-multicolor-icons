/* Local overrides of Onshape's native SVG paint roles; no geometry replacement. */
globalThis.OSVC = (() => {
  const defaults = { enabled: true, toolbar: true, tree: true, labels: false, groups: true };
  const scopes = {
    toolbar: ".os-tool-command-icon, .os-element-toolbar, .os-mini-toolbar-panel, .os-toolbar, .os-toolbar-container, .os-vue-custom-toolbar, [role=toolbar], [role=menu], .os-context-menu",
    tree: ".feature-list-container, .plg-feature-list, .os-feature-type-icon, .os-tree-container"
  };
  const blocked = [
    "[disabled]", '[aria-disabled="true"]', '[aria-selected="true"]', '[aria-pressed="true"]',
    '[from-uri="true"]', '[fromuri="true"]', ".os-custom-feature",
    ".os-disabled", ".os-mini-toolbar-command-disabled", ".os-context-menu-disabled", ".os-disabled-context-menu-item",
    ".os-selected", ".os-selected-item", ".os-selected-row", ".os-node--selected", ".os-node--parent-selected", ".os-node--active-node",
    ".os-active", ".os-tool-button.is-active", ".os-tool-button.active", ".os-tool-command.is-active",
    ".os-error", ".os-warning", ".has-error", ".has-warning", ".os-suppressed",
    '[class*="regen-error"]', '[class*="feature-error"]', '[class*="feature-warning"]',
    '[class*="rolled-back"]', '[class*="suppressed"]'
  ].join(", ");
  const protectedRefs = ["error", "warning", "suppressed", "overlay", "selected", "highlight", "cancel", "ok-button", "custom-feature", "featurescript", "feature-studio", "constraint-bad"];
  const protectedUses = protectedRefs.map(token => `[*|href*="${token}" i]`).join(", ");
  // href and xlink:href, including assembly and drawing icons without -button.
  // No command-name allowlist: new standard icons inherit their paint roles.
  const allIcons = `svg:has(> use[*|href^="#svg-icon-"]):not(:has(> image)):not(:has(> use:is(${protectedUses})))`;
  const guard = `:not(:is(${blocked})):not(:is(${blocked}) *)`;
  const paint = {
    "--os-icon-fill-secondary--static": "#74AFE2",
    "--os-icon-fill-secondary": "#74AFE2",
    "--os-icon-fill-tertiary--static": "#4779A3",
    "--os-icon-fill-tertiary": "#4779A3",
    "--os-icon-fill-quaternary--static": "#D9E7F3",
    "--os-icon-fill-quaternary": "#D9E7F3",
    "--os-icon-accent-primary": "#216BC4",
    "--os-icon-accent-primary-static": "#216BC4",
    "--os-icon-accent-secondary": "#B2D8F5",
    "--os-icon-accent-secondary--static": "#B2D8F5",
    "--os-icon-accent-tertiary": "#216BC4"
  };
  function settings(value = {}) {
    // v0.1 tint is retired; the three user-selected scope switches are retained.
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, typeof value?.[key] === "boolean" ? value[key] : fallback]));
  }
  function css() {
    const declarations = Object.entries(paint).map(([key, value]) => `${key}: ${value} !important;`).join("\n");
    return Object.entries(scopes).map(([scope, selector]) =>
      `html[data-osvc-enabled="true"][data-osvc-${scope}="true"] :is(${selector}) ${allIcons}${guard} {\n${declarations}\n}`
    ).join("\n");
  }
  return { defaults, scopes, blocked, allIcons, paint, settings, css };
})();
