import { isRuleOn, loadConfig, onConfigChange, type Config } from './config';
import { RULES } from './rules';
import { el, enabledSwitch, homeSelect, ruleRow, skinField } from './ui';

let config: Config;
const getConfig = () => config;

function render(): void {
  const hidden = RULES.filter((r) => r.kind === 'hide' && isRuleOn(config, r)).length;
  const filters = RULES.filter((r) => r.kind !== 'hide' && isRuleOn(config, r)).length;
  const options = el('button', { className: 'link', textContent: 'Tous les réglages →' });
  options.addEventListener('click', () => chrome.runtime.openOptionsPage());

  document.body.replaceChildren(
    el('header', {}, [el('h1', {}, ['Axome OS allégé']), enabledSwitch(getConfig)]),
    el('p', { className: 'muted' }, [config.enabled ? `${filters} préfiltres et ${hidden} masquages actifs.` : 'Désactivé : Axome OS s’affiche tel quel.']),
    el('label', { className: 'field' }, ['Page d’accueil', homeSelect(getConfig)]),
    skinField(getConfig),
    el('h2', {}, ['Préfiltres']),
    el('div', { className: 'rules' }, RULES.filter((r) => r.kind !== 'hide').map((r) => ruleRow(r, getConfig))),
    el('footer', {}, [options, el('span', { className: 'muted' }, ['Alt+Shift+A sur la page'])]),
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
