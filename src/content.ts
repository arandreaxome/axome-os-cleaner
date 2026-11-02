import { DEFAULT_CONFIG, HOME_PATHS, isRuleOn, loadConfig, normalize, onConfigChange, saveConfig, type Config } from './config';
import { RULES, type HideRule, type PresetRule, type RedirectRule, type Rule } from './rules';

const ATTR = 'data-axc-hide';
const OFF_ATTR = 'data-axc-off';
// Habillage : src/skin.css (injecté par le manifeste) ne s'applique que sous cet attribut.
const SKIN_ATTR = 'data-axc-skin';
// Copie de la config dans le localStorage de la page : lisible tout de suite au chargement,
// avant que l'app ne démarre (chrome.storage ne répond qu'en asynchrone).
const CACHE_KEY = 'axome-cleaner:config';
const HOME = /^\/(?:dashboard(?:\/my-activity)?)?\/?$/;

let config = readCache();
let lastPath: string | null = null;

function readCache(): Config {
  try {
    return normalize(JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null'));
  } catch {
    return DEFAULT_CONFIG;
  }
}

function active<T extends Rule>(kind: T['kind']): T[] {
  return RULES.filter((r): r is T => r.kind === kind && isRuleOn(config, r));
}

/** Identifiant staff de l'utilisateur, repris des clés que l'app enregistre elle-même. */
function staffId(): string | null {
  for (let i = 0; i < localStorage.length; i++) {
    const m = /^(?:my-work:|helpdesk_inbox_prefs:)([0-9a-f-]{36})/.exec(localStorage.key(i) ?? '');
    if (m) return m[1];
  }
  return null;
}

/** Page à ouvrir à la place de `path` quand c'est la page d'un élément masqué (onglet…), sinon null. */
function replacement(path: string): string | null {
  for (const r of active<HideRule>('hide')) if (r.page?.path.test(path)) return path.replace(r.page.path, r.page.to);
  return null;
}

/**
 * Préfiltres et pages d'éléments masqués, appliqués en arrivant sur une page ; au chargement complet,
 * aussi la page d'accueil et les redirections (dans l'app, elles passent par le clic : voir redirectOnClick).
 */
function onEnter(initial: boolean): void {
  const url = new URL(location.href);
  if (config.enabled) {
    // Un lien qui porte déjà des paramètres (lien copié, filtre précis) n'est jamais redirigé.
    if (initial && url.search === '') {
      if (config.home !== 'dashboard' && HOME.test(url.pathname)) url.pathname = HOME_PATHS[config.home];
      for (const r of active<RedirectRule>('redirect')) if (r.path.test(url.pathname)) url.pathname = r.to;
    }
    // Les paramètres de la page masquée (?sub=planification…) ne valent pas pour la page de remplacement.
    const to = replacement(url.pathname);
    if (to) {
      url.pathname = to;
      url.search = '';
    }
    const ctx = { staffId: staffId() };
    for (const r of active<PresetRule>('preset')) {
      if (!r.path.test(url.pathname)) continue;
      for (const [key, value] of Object.entries(r.params(ctx) ?? {})) {
        if (!url.searchParams.has(key)) url.searchParams.set(key, value);
      }
    }
  }
  lastPath = url.pathname;
  if (url.href === location.href) return;
  history.replaceState(history.state, '', url.href);
  // Avant le démarrage de l'app, le routeur lira la nouvelle URL ; ensuite, il faut le prévenir.
  if (!initial) window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Clic sur un lien interne vers une page redirigée (menu « Helpdesk »…) : on va directement
 * à la cible. Une fois sur la page, l'app réécrit l'URL avec ses filtres mémorisés, et on ne
 * distinguerait plus un lien simple d'un lien filtré. Un lien vers la page d'un élément masqué
 * mène aussi directement à sa page de remplacement, sans afficher la page masquée.
 */
function redirectOnClick(e: MouseEvent): void {
  if (!config.enabled || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!link) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin) return;
  const to =
    replacement(url.pathname) ??
    (url.search ? undefined : active<RedirectRule>('redirect').find((r) => r.path.test(url.pathname) && !location.pathname.startsWith(r.section))?.to);
  if (!to) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  // Même forme d'état que l'historique de React Router, pour que le bouton Retour reste cohérent.
  const state = history.state ?? {};
  history.pushState({ ...state, key: Math.random().toString(36).slice(2, 10), idx: (state.idx ?? 0) + 1 }, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Attributs de <html> : vue d'origine (Alt+Shift+A) et habillage. */
function applyRoot(): void {
  document.documentElement?.toggleAttribute(OFF_ATTR, !config.enabled);
  document.documentElement?.toggleAttribute(SKIN_ATTR, config.enabled && config.skin);
}

/**
 * Recalcule à chaque passage ce que chaque règle masque : l'app réutilise ses éléments
 * (cellules d'un tableau dont les colonnes changent…), une marque posée peut devenir fausse.
 */
function applyHide(): void {
  applyRoot();
  const path = location.pathname;
  for (const r of RULES) {
    if (r.kind !== 'hide') continue;
    const wanted = config.enabled && isRuleOn(config, r) && (!r.path || r.path.test(path)) ? new Set(r.find()) : new Set<Element>();
    for (const el of document.querySelectorAll(`[${ATTR}="${CSS.escape(r.id)}"]`)) if (!wanted.has(el)) el.removeAttribute(ATTR);
    for (const el of wanted) if (el.getAttribute(ATTR) !== r.id) el.setAttribute(ATTR, r.id);
  }
  // Titre de section du menu dont tous les liens sont masqués
  for (const section of document.querySelectorAll('aside nav > div')) {
    const links = [...section.querySelectorAll('a')];
    const empty = links.length > 0 && links.every((a) => a.hasAttribute(ATTR));
    if (empty) section.setAttribute(ATTR, 'menu:section');
    else if (section.getAttribute(ATTR) === 'menu:section') section.removeAttribute(ATTR);
  }
}

let timer = 0;
function schedule(): void {
  if (!timer) timer = window.setTimeout(tick, 60);
}

function tick(): void {
  timer = 0;
  if (location.pathname !== lastPath) onEnter(false);
  applyHide();
}

function setConfig(next: Config): void {
  config = next;
  localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  applyHide();
}

function toast(message: string): void {
  const el = document.createElement('div');
  el.textContent = message;
  el.style.cssText =
    'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:8px 14px;border-radius:8px;' +
    'background:#1e2340;color:#fff;font:500 13px/1.4 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35);pointer-events:none';
  document.body.append(el);
  setTimeout(() => el.remove(), 1600);
}

// Au tout début du chargement, <html> n'existe parfois pas encore.
const style = document.createElement('style');
style.textContent = `html:not([${OFF_ATTR}]) [${ATTR}] { display: none !important; }`;
// L'habillage est posé dès que <html> existe, pour ne pas voir passer les couleurs d'origine.
function mount(): void {
  document.documentElement.append(style);
  applyRoot();
}
if (document.documentElement) mount();
else {
  new MutationObserver((_, observer) => {
    if (!document.documentElement) return;
    observer.disconnect();
    mount();
  }).observe(document, { childList: true });
}

onEnter(true);
new MutationObserver(schedule).observe(document, { childList: true, subtree: true });
window.addEventListener('popstate', schedule);
window.addEventListener('click', redirectOnClick, true);

loadConfig().then(setConfig);
onConfigChange(setConfig);

// Alt+Shift+A : bascule entre la vue allégée et la vue d'origine.
window.addEventListener(
  'keydown',
  (e) => {
    if (!e.altKey || !e.shiftKey || e.metaKey || e.ctrlKey || e.code !== 'KeyA') return;
    e.preventDefault();
    e.stopPropagation();
    const next = { ...config, enabled: !config.enabled };
    setConfig(next);
    toast(next.enabled ? 'Axome OS allégé : activé' : 'Axome OS allégé : vue d’origine');
    saveConfig(next).catch(() => toast('Extension rechargée : recharge la page'));
  },
  true,
);
