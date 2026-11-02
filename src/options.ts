import { DEFAULT_CONFIG, loadConfig, onConfigChange, saveConfig, type Config } from './config';
import { GROUPS, RULES } from './rules';
import { el, enabledSwitch, homeSelect, ruleRow, skinField } from './ui';

let config: Config;
const getConfig = () => config;
const root = document.getElementById('app')!;

function render(): void {
  const reset = el('button', { textContent: 'Revenir aux réglages par défaut' });
  reset.addEventListener('click', () => void saveConfig({ ...DEFAULT_CONFIG, enabled: config.enabled }));

  root.replaceChildren(
    el('header', {}, [el('h1', {}, ['Axome OS allégé']), enabledSwitch(getConfig)]),
    el('p', { className: 'muted' }, [
      'Les réglages sont enregistrés tout de suite et synchronisés avec ton compte Chrome. ',
      'Les préfiltres s’appliquent en arrivant sur une page : tu peux toujours changer les filtres ensuite. ',
      'Alt+Shift+A sur Axome OS bascule entre la vue allégée et la vue d’origine.',
    ]),
    el('section', {}, [
      el('h2', {}, ['Général']),
      el('label', { className: 'field' }, ['Page d’accueil à l’ouverture d’Axome OS', homeSelect(getConfig)]),
      skinField(getConfig),
    ]),
    ...GROUPS.map((group) =>
      el('section', {}, [el('h2', {}, [group]), el('div', { className: 'rules' }, RULES.filter((r) => r.group === group).map((r) => ruleRow(r, getConfig)))]),
    ),
    el('footer', {}, [reset]),
  );
  document.body.classList.toggle('off', !config.enabled);
}

loadConfig().then((c) => {
  config = c;
  render();
});
onConfigChange((c) => {
  config = c;
  render();
});
