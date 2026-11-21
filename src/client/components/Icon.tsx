import { ICONS } from '../gen/icons';

export function Icon({ name, className, title }: { name: string; className?: string; title?: string }) {
  const body = ICONS[name] ?? ICONS['info'];
  return (
    <svg className={`icon ${className ?? ''}`} viewBox="0 0 512 512" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} dangerouslySetInnerHTML={{ __html: (title ? `<title>${title}</title>` : '') + body }} />
  );
}

export const JUNK_ICON: Record<string, string> = {
  raid: 'flaming-claw',
  injure: 'human-target',
  restore: 'bandage-roll',
  draw: 'card-draw',
  drifter: 'hooded-figure',
  water: 'water-drop',
};

/** Inline water-drop icon used wherever text mentions a water cost (replaces the 💧 emoji). */
export function Drop({ className }: { className?: string }) {
  return <Icon name="water-drop" className={`ico-inline ico-water ${className ?? ''}`} />;
}
