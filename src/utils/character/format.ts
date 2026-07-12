import type { DamageInfo } from '@/services/dndbeyond/model';
import { formatModifier } from './dnd5e';

/**
 * Render a damage line: "1d8+2 Piercing", a flat "3 Bludgeoning", and an
 * optional higher-level scaling note, e.g. "2d6 Fire (+1d6/slot)". Returns an
 * empty string when there is nothing to show.
 */
export function formatDamage(damage: DamageInfo | undefined | null): string {
  if (!damage) return '';
  const dice = damage.dice
    ? `${damage.dice}${damage.bonus ? formatModifier(damage.bonus) : ''}`
    : String(damage.bonus ?? 0);
  const typed = damage.type ? `${dice} ${damage.type}` : dice;
  return damage.scaling ? `${typed} (${damage.scaling})` : typed;
}
