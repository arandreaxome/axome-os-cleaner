import { HOME_LABELS, isRuleOn, saveConfig, type Config, type Home } from './config';
import type { Rule } from './rules';

export const KIND_LABELS: Record<Rule['kind'], string> = { preset: 'Préfiltre', redirect: 'Redirection', hide: 'Masquer' };

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, children: (Node | string)[] = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

/** Case à cocher d'une règle, enregistrée dès qu'on la change. */
export function ruleRow(rule: Rule, getConfig: () => Config): HTMLElement {
  const input = el('input', { type: 'checkbox', checked: isRuleOn(getConfig(), rule) });
  input.addEventListener('change', () => {
    const config = getConfig();
    void saveConfig({ ...config, rules: { ...config.rules, [rule.id]: input.checked } });
  });
  const text = el('span', { className: 'rule-text' }, [el('span', {}, [rule.label]), ...(rule.hint ? [el('small', {}, [rule.hint])] : [])]);
  return el('label', { className: 'rule' }, [input, text, el('span', { className: `kind kind-${rule.kind}` }, [KIND_LABELS[rule.kind]])]);
}

export function homeSelect(getConfig: () => Config): HTMLSelectElement {
  const select = el(
    'select',
    {},
    Object.entries(HOME_LABELS).map(([value, label]) => el('option', { value, textContent: label })),
  );
  select.value = getConfig().home;
  select.addEventListener('change', () => void saveConfig({ ...getConfig(), home: select.value as Home }));
  return select;
}

export function skinField(getConfig: () => Config): HTMLLabelElement {
  const input = el('input', { type: 'checkbox', checked: getConfig().skin });
  input.addEventListener('change', () => void saveConfig({ ...getConfig(), skin: input.checked }));
  return el('label', { className: 'field', title: 'Palette mate de Galaxia Radar, angles vifs, sans ombres. La police ne change pas.' }, [
    'Thème « Olive »',
    input,
  ]);
}

export function enabledSwitch(getConfig: () => Config): HTMLLabelElement {
  const input = el('input', { type: 'checkbox', checked: getConfig().enabled });
  input.addEventListener('change', () => void saveConfig({ ...getConfig(), enabled: input.checked }));
  return el('label', { className: 'switch', title: 'Activer / désactiver (Alt+Shift+A sur la page)' }, [input, el('span')]);
}
