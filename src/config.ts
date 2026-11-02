export type Home = 'dashboard' | 'my-tasks' | 'production';

export interface Config {
  enabled: boolean;
  home: Home;
  /** Thème « Olive » (palette et style de Galaxia Radar, voir src/skin.css). */
  skin: boolean;
  /** Règles activées ou désactivées à la main ; une règle absente garde sa valeur par défaut. */
  rules: Record<string, boolean>;
}

export const DEFAULT_CONFIG: Config = { enabled: true, home: 'dashboard', skin: true, rules: {} };

export const HOME_PATHS: Record<Home, string> = {
  dashboard: '/dashboard/my-activity',
  'my-tasks': '/my-tasks',
  production: '/helpdesk/production',
};

export const HOME_LABELS: Record<Home, string> = {
  dashboard: 'Dashboard (par défaut)',
  'my-tasks': 'Mon travail',
  production: 'Helpdesk · Ma production',
};

const STORAGE_KEY = 'config';

export function normalize(raw: unknown): Config {
  const c = (raw ?? {}) as Partial<Config>;
  return {
    enabled: c.enabled ?? DEFAULT_CONFIG.enabled,
    home: c.home && c.home in HOME_PATHS ? c.home : DEFAULT_CONFIG.home,
    skin: c.skin ?? DEFAULT_CONFIG.skin,
    rules: c.rules ?? {},
  };
}

export async function loadConfig(): Promise<Config> {
  const data = await chrome.storage.sync.get(STORAGE_KEY);
  return normalize(data[STORAGE_KEY]);
}

export async function saveConfig(config: Config): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: config });
}

export function onConfigChange(callback: (config: Config) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[STORAGE_KEY]) callback(normalize(changes[STORAGE_KEY].newValue));
  });
}

export function isRuleOn(config: Config, rule: { id: string; default: boolean }): boolean {
  return config.rules[rule.id] ?? rule.default;
}
