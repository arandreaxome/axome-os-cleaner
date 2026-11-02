// Catalogue des règles : seul fichier qui dépend du DOM et des URL d'Axome OS.
// Après une mise à jour de l'app, c'est ici qu'on corrige un sélecteur ou un paramètre.

export type Group = 'Menu' | 'En-tête' | 'Dashboard' | 'Mon travail' | 'Projets' | 'Fiche projet' | 'Helpdesk' | 'Planning & Staff';

export const GROUPS: Group[] = ['Menu', 'En-tête', 'Dashboard', 'Mon travail', 'Projets', 'Fiche projet', 'Helpdesk', 'Planning & Staff'];

export interface Context {
  staffId: string | null;
}

interface BaseRule {
  id: string;
  group: Group;
  label: string;
  default: boolean;
  hint?: string;
}

/** Ajoute des paramètres de filtre à l'URL en entrant sur la page (l'app relit ses filtres dans l'URL). */
export interface PresetRule extends BaseRule {
  kind: 'preset';
  path: RegExp;
  params: (ctx: Context) => Record<string, string> | null;
}

/** Redirige vers une autre page en entrant dans une section depuis l'extérieur (`section` : préfixe de la section). */
export interface RedirectRule extends BaseRule {
  kind: 'redirect';
  path: RegExp;
  to: string;
  section: string;
}

export interface HideRule extends BaseRule {
  kind: 'hide';
  path?: RegExp;
  find: () => Element[];
  /** Page de l'élément masqué (un onglet) : on n'y arrive plus, on va à `to` (remplacement de `path`). */
  page?: { path: RegExp; to: string };
}

export type Rule = PresetRule | RedirectRule | HideRule;

const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
const all = (selector: string): Element[] => [...document.querySelectorAll(selector)];

const menuLink = (href: string) => () => all(`aside nav a[href="${href}"]`);
const tab = (value: string) => () => all(`[role="tab"][id$="-trigger-${value}"]`);

const buttons = (labels: string[]) => () =>
  all('main button').filter((b) => {
    const text = norm(b.textContent);
    return labels.some((l) => text.startsWith(l));
  });

/**
 * Bloc de <main> qui contient le texte `anchor` et tous les textes `context`,
 * élargi à `closest` si donné, puis aux conteneurs qui n'ont que lui comme enfant.
 */
function block(anchor: string, context: string[], closest?: string): () => Element[] {
  return () => {
    const main = document.querySelector('main');
    if (!main) return [];
    const found: Element[] = [];
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue?.includes(anchor)) continue;
      let el = node.parentElement;
      while (el && el !== main && !context.every((c) => el!.textContent!.includes(c))) el = el.parentElement;
      if (el && closest) el = el.closest(closest);
      if (!el || el === main || !main.contains(el)) continue;
      while (el.parentElement && el.parentElement !== main && el.parentElement.children.length === 1) el = el.parentElement;
      if (!found.includes(el)) found.push(el);
    }
    return found;
  };
}

/** Cellules des colonnes de tableau dont l'en-tête commence par l'un des libellés. */
function columns(headers: string[]) {
  return () => {
    const cells: Element[] = [];
    for (const table of document.querySelectorAll('main table')) {
      const head = (table as HTMLTableElement).tHead?.rows[0];
      if (!head) continue;
      const indexes = [...head.cells].flatMap((c, i) => (headers.some((h) => norm(c.textContent).toLowerCase().startsWith(h.toLowerCase())) ? [i] : []));
      if (!indexes.length) continue;
      for (const row of (table as HTMLTableElement).rows) {
        // Les lignes de regroupement (une cellule fusionnée) sont laissées telles quelles.
        if (row.cells.length === head.cells.length) for (const i of indexes) cells.push(row.cells[i]);
      }
    }
    return cells;
  };
}

const PROJECTS_LIST = /^\/projects(?:\/(?!detail)[^/]*)?\/?$/;
const PROJECT_DETAIL = /^\/projects\/detail\//;
// /helpdesk au premier chargement, /helpdesk/inbox quand on passe par l'onglet
const HELPDESK_INBOX = /^\/helpdesk(?:\/inbox)?\/?$/;
const STAFF = /^\/(?:staff|planning)(?:\/|$)/;

const hideTab = (group: Group, path: RegExp, value: string, label: string, on: boolean): HideRule => ({
  kind: 'hide',
  id: `tab:${group}:${value}`,
  group,
  label: `Onglet « ${label} »`,
  default: on,
  path,
  find: tab(value),
});

// Onglet de la fiche projet : son URL (lien de la liste, URL directe) ouvre « Tâches » à la place.
// Info est aussi l'onglet par défaut, sans segment dans l'URL.
const hideProjectTab = (value: string, label: string, on: boolean, hint?: string): HideRule => ({
  ...hideTab('Fiche projet', PROJECT_DETAIL, value, label, on),
  hint,
  page: { path: new RegExp(`^(/projects/detail/[^/]+)${value === 'infos' ? '(?:/infos)?' : `/${value}`}/?$`), to: '$1/tasks' },
});

const hideMenu = (href: string, label: string, on: boolean): HideRule => ({
  kind: 'hide',
  id: `menu:${href}`,
  group: 'Menu',
  label: `« ${label} »`,
  default: on,
  find: menuLink(href),
});

export const RULES: Rule[] = [
  // Menu latéral (un titre de section disparaît quand tous ses liens sont masqués)
  hideMenu('/', 'Dashboard', false),
  hideMenu('/ai-tools', 'Portail AI', true),
  hideMenu('/staff', 'Planning & Staff', false),
  hideMenu('/websites', 'Websites', true),
  hideMenu('/integrations', 'Partenaires', true),
  hideMenu('/meetings', 'Réunions', true),
  hideMenu('/communication', 'Communication', true),

  // En-tête
  { kind: 'hide', id: 'header:sidekick', group: 'En-tête', label: 'Bouton Sidekick (assistant IA)', default: false, find: () => all('header button[aria-label="Ouvrir le Sidekick"]') },
  { kind: 'hide', id: 'header:favorites', group: 'En-tête', label: 'Bouton Favoris', default: false, find: () => all('header button[aria-label="Favoris"]') },
  {
    kind: 'hide',
    id: 'header:notif-badge',
    group: 'En-tête',
    label: 'Pastille du nombre de notifications',
    default: false,
    find: () => all('header button[aria-label^="Notifications"] span').filter((s) => /^\d+\+?$/.test(norm(s.textContent))),
  },

  // Dashboard
  {
    kind: 'hide',
    id: 'dashboard:checkin',
    group: 'Dashboard',
    label: 'Bloc « Confiance / Où seras-tu ? »',
    hint: "Ce check-in est partagé avec l'équipe : le masquer, c'est ne plus le remplir.",
    default: true,
    path: /^\/(?:dashboard(?:\/my-activity)?)?\/?$/,
    find: block('Où seras-tu', ['Confiance'], '.bg-card'),
  },
  hideTab('Dashboard', /^\/(?:dashboard(?:\/|$)|$)/, 'activity', 'Activité Axome', true),

  // Mon travail
  {
    kind: 'preset',
    id: 'my-tasks:kinds',
    group: 'Mon travail',
    label: 'Seulement mes tâches et tickets',
    hint: 'Retire les actions CRM, les contenus comm et les livrables.',
    default: true,
    path: /^\/my-tasks\/?$/,
    params: () => ({ mt_kinds: 'task,ticket' }),
  },
  {
    kind: 'preset',
    id: 'my-tasks:group',
    group: 'Mon travail',
    label: 'Regrouper par projet / client',
    default: true,
    path: /^\/my-tasks\/?$/,
    params: () => ({ mt_group: 'context' }),
  },
  {
    kind: 'hide',
    id: 'my-tasks:kpi',
    group: 'Mon travail',
    label: 'Cartes compteurs (En retard, Aujourd’hui, 7 jours, Plus tard)',
    default: false,
    path: /^\/my-tasks\/?$/,
    find: block('La semaine qui vient', ['En retard', 'Plus tard']),
  },

  // Projets
  {
    kind: 'preset',
    id: 'projects:mine',
    group: 'Projets',
    label: 'Seulement mes projets (pilote ou équipe)',
    default: true,
    path: /^\/projects(?:\/projects)?\/?$/,
    params: () => ({ prj_mine: '1' }),
  },
  hideTab('Projets', PROJECTS_LIST, 'run', 'Run', false),
  hideTab('Projets', PROJECTS_LIST, 'crea', 'Créa', true),
  hideTab('Projets', PROJECTS_LIST, 'avancement', 'Avancement', true),
  hideTab('Projets', PROJECTS_LIST, 'stats', 'Statistiques', true),
  hideTab('Projets', PROJECTS_LIST, 'deliverables', 'Livrables', true),
  { kind: 'hide', id: 'projects:col-mood', group: 'Projets', label: 'Colonne « Mood »', default: true, path: PROJECTS_LIST, find: columns(['Mood']) },
  { kind: 'hide', id: 'projects:col-team', group: 'Projets', label: 'Colonne « Équipe »', default: false, path: PROJECTS_LIST, find: columns(['Équipe']) },

  // Fiche projet
  {
    kind: 'preset',
    id: 'project:tasks-mine',
    group: 'Fiche projet',
    label: 'Onglet Tâches : seulement celles qui me sont assignées',
    hint: 'Il faut avoir ouvert « Mon travail » une fois pour que l’extension connaisse ton identifiant.',
    default: true,
    path: /^\/projects\/detail\/[^/]+\/tasks\/?$/,
    params: (ctx) => (ctx.staffId ? { pjt_assignee: ctx.staffId } : null),
  },
  hideProjectTab('infos', 'Info', true, 'Un lien vers un onglet masqué ouvre « Tâches ».'),
  hideProjectTab('recette', 'Recette', false),
  hideProjectTab('planning', 'Planification', true),
  hideProjectTab('budget', 'Budget', true),
  hideProjectTab('deliverables', 'Livrables', true),
  hideProjectTab('memos', 'Mémos', true),
  hideProjectTab('deployments', 'Déploiements', true),
  hideProjectTab('meetings', 'Réunions', true),
  hideProjectTab('tools', 'Outils', true),
  { kind: 'hide', id: 'project:monday', group: 'Fiche projet', label: 'Boutons de synchro Monday', default: false, path: PROJECT_DETAIL, find: buttons(['Synchro Monday', 'Monday → AxomeOS']) },

  // Helpdesk
  {
    kind: 'redirect',
    id: 'helpdesk:production',
    group: 'Helpdesk',
    label: 'Ouvrir le Helpdesk sur « Ma production »',
    hint: 'Au lieu de « À trier ». Les onglets restent accessibles.',
    default: true,
    path: HELPDESK_INBOX,
    to: '/helpdesk/production',
    section: '/helpdesk',
  },
  {
    kind: 'preset',
    id: 'helpdesk:inbox-mine',
    group: 'Helpdesk',
    label: 'Boîte de réception : ouvrir sur « Assignés à moi »',
    default: true,
    path: HELPDESK_INBOX,
    params: () => ({ inb_view: 'mine' }),
  },
  hideTab('Helpdesk', /^\/helpdesk(?:\/|$)/, 'board', 'Board client', false),
  {
    kind: 'hide',
    id: 'helpdesk:global-views',
    group: 'Helpdesk',
    label: 'Boîte de réception : vues globales (Tous, Nouveaux, Urgents, Réponse CDP…)',
    default: true,
    path: HELPDESK_INBOX,
    find: buttons(['Tous', 'Nouveaux', 'Urgents', 'Réponse CDP', 'Réponse client', '+ de 7j']),
  },
  {
    kind: 'hide',
    id: 'helpdesk:global-stats',
    group: 'Helpdesk',
    label: 'Boîte de réception : compteurs globaux (Ouverts, 1re réponse…)',
    default: true,
    path: HELPDESK_INBOX,
    find: block('1re réponse en retard', ['Ouverts']),
  },
  { kind: 'hide', id: 'helpdesk:col-supervisor', group: 'Helpdesk', label: 'Boîte de réception : colonne « Superviseur »', default: true, path: HELPDESK_INBOX, find: columns(['Superviseur']) },
  { kind: 'hide', id: 'helpdesk:col-time', group: 'Helpdesk', label: 'Boîte de réception : colonne « Temps passé »', default: false, path: HELPDESK_INBOX, find: columns(['Temps passé']) },
  {
    kind: 'hide',
    id: 'helpdesk:production-kpi',
    group: 'Helpdesk',
    label: 'Ma production : bandeau de compteurs',
    default: false,
    path: /^\/helpdesk\/production\/?$/,
    find: block('Client silencieux', ['À répondre']),
  },
  {
    kind: 'hide',
    id: 'helpdesk:production-load',
    group: 'Helpdesk',
    label: 'Ma production : barre de charge (Produits, Supervisés, Estimé)',
    default: false,
    path: /^\/helpdesk\/production\/?$/,
    find: block('Supervisés', ['Produits', 'Estimé'], '.bg-card'),
  },

  // Planning & Staff
  hideTab('Planning & Staff', STAFF, 'planification', 'Hebdo', false),
  hideTab('Planning & Staff', STAFF, 'charge', 'Charge', false),
  hideTab('Planning & Staff', STAFF, 'directory', 'Annuaire', false),
  hideTab('Planning & Staff', STAFF, 'tools', 'Outils', false),
];
