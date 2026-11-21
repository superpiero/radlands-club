import { ICONS } from '../gen/icons';
import { UI_ICONS } from '../gen/uiIcons';

/** Interface glyphs that now come from the edition's own outline set (ikony-rozhrani.svg). */
const UI_ALIAS: Record<string, string> = {
  'rule-book': 'ui-book',
  'magnifying-glass': 'ui-search',
  'cross-mark': 'ui-close',
  'card-draw': 'ui-cards',
  'stopwatch': 'ui-clock',
  'broken-shield': 'ui-flag',
};

export function Icon({ name, className, title }: { name: string; className?: string; title?: string }) {
  const n = UI_ALIAS[name] ?? name;
  if (n.startsWith('ui-') && UI_ICONS[n.slice(3)]) {
    return (
      <svg className={`icon ui ${className ?? ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}
        dangerouslySetInnerHTML={{ __html: (title ? `<title>${title}</title>` : '') + UI_ICONS[n.slice(3)] }} />
    );
  }
  const body = ICONS[name] ?? ICONS['info'];
  return (
    <svg className={`icon ${className ?? ''}`} viewBox="0 0 512 512" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} dangerouslySetInnerHTML={{ __html: (title ? `<title>${title}</title>` : '') + body }} />
  );
}

export const JUNK_ICON: Record<string, string> = {
  raid: 'ui-target',
  injure: 'ui-attack',
  restore: 'ui-heart',
  draw: 'ui-cards',
  drifter: 'ui-unit',
  water: 'ui-water',
};

/** Inline water-drop icon used wherever text mentions a water cost (replaces the 💧 emoji). */
export function Drop({ className }: { className?: string }) {
  return <Icon name="water-drop" className={`ico-inline ico-water ${className ?? ''}`} />;
}
