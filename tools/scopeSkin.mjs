// Build-time PostCSS plugin: scopes the two UI libraries to the active skin so only one applies.
//   98.css            → only when <html> has no data-skin (the classic look)
//   xp.css (XP.css)   → only when <html data-skin="xp">
//   7.css             → only when <html data-skin="7">
// The scope is wrapped in :where(), which adds zero specificity, so our own stylesheets keep
// overriding the libraries exactly as they did when 98.css was global.

export const SCOPE_98 = ':where(:root:not([data-skin]))';
export const SCOPE_XP = ':where(:root[data-skin="xp"])';
export const SCOPE_7 = ':where(:root[data-skin="7"])';

// Split a selector list on top-level commas (not inside :not(...), [attr="a,b"], or strings)
export function splitSelectors(list) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (const ch of list) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '(' || ch === '[') {
      depth += 1;
    } else if (ch === ')' || ch === ']') {
      depth -= 1;
    } else if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// One selector → scoped selector(s)
export function scopeSelector(selector, scope) {
  // html / :root themselves are the scoped element
  const root = /^(html|:root)(?![\w-])/.exec(selector);
  if (root) {
    const rest = selector.slice(root[0].length);
    return [`${scope}${rest}`];
  }
  // Bare pseudo-elements (e.g. ::-webkit-scrollbar) apply to every element, including the root
  if (selector.startsWith('::')) return [`${scope}${selector}`, `${scope} ${selector}`];
  return [`${scope} ${selector}`];
}

export const scopeSelectorList = (list, scope) =>
  splitSelectors(list).flatMap((s) => scopeSelector(s, scope)).join(',');

// Which scope (if any) a CSS file gets
export function scopeForFile(file = '') {
  const path = file.replace(/\\/g, '/');
  if (/\/98\.css\/dist\/98\.css$/.test(path)) return SCOPE_98;
  if (/\/xp\.css\/dist\/XP\.css$/i.test(path)) return SCOPE_XP;
  if (/\/7\.css\/dist\/7\.css$/.test(path)) return SCOPE_7;
  return null;
}

export default function scopeSkin() {
  return {
    postcssPlugin: 'winampify-scope-skin',
    Once(root) {
      const scope = scopeForFile(root.source?.input?.file);
      if (!scope) return;
      root.walkRules((rule) => {
        const parent = rule.parent;
        if (parent?.type === 'atrule' && /keyframes$/i.test(parent.name)) return;
        rule.selector = scopeSelectorList(rule.selector, scope);
      });
      // XP.css also declares a DOS font we never use; don't ship it
      root.walkAtRules('font-face', (at) => {
        if (/Perfect DOS VGA/i.test(at.toString())) at.remove();
      });
    }
  };
}
scopeSkin.postcss = true;
