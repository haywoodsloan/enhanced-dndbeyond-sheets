import type { CompanionEntry, RuleTable, SectionKey, StructuredList } from './model';
import type { RawCharacter } from './api-types';
import { ABILITIES, abilityModifier } from '@/utils/character/dnd5e';

type Text = (html: string) => string;
interface HtmlBlock { html: string; start: number; end: number }

function tableGrid(table: string, text: Text): { columns: string[]; rows: string[][] } {
  const sourceRows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const grid: string[][] = [];
  const headerRows = new Set<number>();
  let inLeadingHeaders = true;
  const lower = table.toLowerCase();
  sourceRows.forEach((row, index) => {
    const cells = [...row[1].matchAll(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi)];
    const prefix = lower.slice(0, row.index);
    const inHead = prefix.lastIndexOf('<thead') > prefix.lastIndexOf('</thead');
    if (inHead || (inLeadingHeaders && cells.length > 0 && cells.every((cell) => cell[1].toLowerCase() === 'th'))) {
      headerRows.add(index);
    } else if (cells.length) inLeadingHeaders = false;
    grid[index] ??= [];
    let column = 0;
    for (const cell of cells) {
      while (grid[index][column] !== undefined) column++;
      const span = (name: string) => Math.min(256, Math.max(1,
        Number(new RegExp(`\\b${name}\\s*=\\s*["']?(\\d+)`, 'i').exec(cell[2])?.[1] ?? 1)));
      const width = span('colspan');
      const height = span('rowspan');
      const value = text(cell[3]);
      for (let y = index; y < Math.min(sourceRows.length, index + height); y++) {
        grid[y] ??= [];
        for (let x = column; x < column + width; x++) grid[y][x] = value;
      }
      column += width;
    }
  });
  const width = Math.max(0, ...grid.map((row) => row.length));
  const columns = Array.from({ length: width }, (_, column) => {
    for (const row of [...headerRows].reverse()) if (grid[row]?.[column]) return grid[row][column];
    return '';
  });
  const rows = grid.filter((row, index) => !headerRows.has(index) && row.some(Boolean))
    .map((row) => Array.from({ length: width }, (_, column) => row[column] ?? ''));
  return { columns, rows };
}

function statBlocks(html: string): HtmlBlock[] {
  const blocks: HtmlBlock[] = [];
  const opening = /<div\b[^>]*class=["']([^"']*)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = opening.exec(html))) {
    if (!match[1].split(/\s+/).some((name) => /^(?:stat-block|stat-block-finder)$/.test(name))) continue;
    const tags = /<\/?div\b[^>]*>/gi;
    tags.lastIndex = match.index;
    let depth = 0;
    let tag: RegExpExecArray | null;
    while ((tag = tags.exec(html))) {
      depth += /^<\/div/i.test(tag[0]) ? -1 : 1;
      if (depth === 0) {
        blocks.push({ html: html.slice(match.index, tags.lastIndex), start: match.index, end: tags.lastIndex });
        opening.lastIndex = tags.lastIndex;
        break;
      }
    }
  }
  return blocks;
}

export function leadingLabel(inner: string, text: Text): { label: string; rest: string } | undefined {
  const nested = inner.match(
    /^\s*<(strong|b|em|i)\b[^>]*>\s*<(strong|b|em|i)\b[^>]*>([\s\S]+?)<\/\2>\s*<\/\1>\s*/i,
  );
  const single = inner.match(/^\s*<(strong|b)\b[^>]*>([\s\S]+?)<\/\1>\s*/i);
  const marker = nested && [nested[1], nested[2]].some((tag) => /^(strong|b)$/i.test(tag)) ? nested : single;
  if (!marker) return undefined;
  const label = text(marker.length === 4 ? marker[3] : marker[2]).replace(/[.:]\s*$/, '').trim();
  return label ? { label, rest: text(inner.slice(marker[0].length)) } : undefined;
}

export function structuredList(html: string, text: Text): StructuredList | undefined {
  const items = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].flatMap((match) => {
    const labeled = leadingLabel(match[1], text);
    const body = text(match[1]);
    return labeled ? [{ label: labeled.label, text: labeled.rest }] : body ? [{ text: body }] : [];
  });
  return items.length ? { items } : undefined;
}

function companion(block: string, source: string, text: Text): CompanionEntry | undefined {
  const title = /<p\b[^>]*class=["'][^"']*Stat-Block-Title[^"']*["'][^>]*>([\s\S]*?)<\/p>/i.exec(block)?.[1]
    ?? /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(block)?.[1];
  const name = text(title ?? '');
  if (!name) return undefined;
  const result: CompanionEntry = { name, source, abilities: [], details: [] };
  const paragraphs = [...block.matchAll(/<(p|h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/gi)]
    .map((match) => ({ tag: match[1], attrs: match[2], inner: match[3], text: text(match[3]) }));
  const meta = paragraphs.find((paragraph) => /Stat-Block-Metadata/i.test(paragraph.attrs))
    ?? paragraphs.find((paragraph) => paragraph.text !== name && !/<(?:strong|b)\b/i.test(paragraph.inner) &&
      !/monster-header|Stat-Block-(?:Data|Body|Heading)/i.test(paragraph.attrs));
  if (meta?.text) result.meta = meta.text;
  let section = 'Details';
  for (const paragraph of paragraphs) {
    if (!paragraph.text || paragraph.text === name || paragraph === meta) continue;
    if (/monster-header|Stat-Block-Heading/i.test(paragraph.attrs) ||
        /^(?:Traits|Actions|Bonus Actions|Reactions|Legendary Actions|Mythic Actions)$/i.test(paragraph.text)) {
      section = paragraph.text;
      continue;
    }
    const labeled = leadingLabel(paragraph.inner, text);
    if (!labeled) {
      result.details.push({ section, label: '', text: paragraph.text });
      continue;
    }
    const key = labeled.label.toLowerCase();
    if (/^(?:ac|armor class)$/.test(key)) result.armorClass = labeled.rest;
    else if (/^(?:hp|hit points)$/.test(key)) result.hitPoints = labeled.rest;
    else if (key === 'speed') result.speed = labeled.rest;
    else if (/^(?:cr|challenge|challenge rating)$/.test(key)) result.challengeRating = labeled.rest;
    else result.details.push({
      section: /resistances|immunities|vulnerabilities|senses|languages/i.test(key) ? 'Statistics' : section,
      label: labeled.label, text: labeled.rest,
    });
  }
  for (const row of block.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((cell) => text(cell[2]));
    if (/^(STR|DEX|CON|INT|WIS|CHA)$/i.test(cells[0] ?? '') && cells[1] && !/^(STR|DEX|CON|INT|WIS|CHA)$/i.test(cells[1])) {
      result.abilities.push({
        key: cells[0].toUpperCase(), score: cells[1],
        ...(cells[2] ? { modifier: cells[2] } : {}),
        ...(cells[3] ? { save: cells[3] } : {}),
      });
    }
  }
  if (!result.abilities.length) {
    const legacy = /stat-block-ability-scores-heading["'][^>]*>(STR|DEX|CON|INT|WIS|CHA)<\/div>[\s\S]*?stat-block-ability-scores-score["'][^>]*>([^<]+)<\/span>[\s\S]*?stat-block-ability-scores-modifier["'][^>]*>([^<]+)<\/span>/gi;
    for (const match of block.matchAll(legacy)) {
      result.abilities.push({ key: match[1], score: text(match[2]), modifier: text(match[3]) });
    }
  }
  return result;
}

/** One collector per character: moved rules are printed once, even when a feature
 * and its action publish the same complete stat block or lookup table. */
export class RuleArtifacts {
  readonly companions: CompanionEntry[] = [];
  readonly tables: RuleTable[] = [];
  readonly #companionsByIdentity = new Map<string, CompanionEntry[]>();
  readonly #tableKeys = new Set<string>();
  readonly #selectedCatalogs = new Map<string, Set<string>>();
  readonly #parentOwners = new Map<number, number>();

  constructor(private readonly text: Text, raw?: RawCharacter) {
    if (!raw) return;
    const names = new Map<number, string>();
    for (const cls of raw.classes ?? []) {
      for (const def of [
        ...(cls.classFeatures ?? []).map((entry) => entry.definition), ...(cls.definition?.classFeatures ?? []),
      ]) {
        if (def?.id != null && def.name && (def.requiredLevel ?? 0) <= cls.level) names.set(def.id, def.name);
      }
    }
    for (const entry of [...(raw.feats ?? []), ...(raw.race?.racialTraits ?? [])]) {
      if (entry.definition?.id != null && entry.definition.name) names.set(entry.definition.id, entry.definition.name);
    }
    const options = Object.values(raw.options ?? {}).flatMap((group) => group ?? []);
    for (const option of options) {
      if (option.definition?.id != null && option.componentId != null) this.#parentOwners.set(option.definition.id, option.componentId);
    }
    for (const option of options) {
      const source = option.componentId == null ? undefined : names.get(option.componentId);
      if (!source || !option.definition?.name) continue;
      const key = this.contentKey(source);
      const selected = this.#selectedCatalogs.get(key) ?? new Set<string>();
      selected.add(this.contentKey(this.text(option.definition.name)));
      this.#selectedCatalogs.set(key, selected);
    }
  }

  private contentKey(value: string): string {
    return value.normalize('NFKC').replace(/[‘’]/g, "'").replace(/[−–—]/g, '-').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private ownerKey(owner: string | number): string {
    const seen = new Set<number>();
    while (typeof owner === 'number' && this.#parentOwners.has(owner) && !seen.has(owner)) {
      seen.add(owner);
      owner = this.#parentOwners.get(owner)!;
    }
    return typeof owner === 'number' ? `feature:${owner}` : this.contentKey(owner);
  }

  withoutArtifacts(html: string): string {
    for (const block of statBlocks(html).reverse()) html = html.slice(0, block.start) + ' ' + html.slice(block.end);
    return html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, ' ');
  }

  addSelectedCreatures(raw: RawCharacter): void {
    const sources = new Map<number, string>();
    for (const cls of raw.classes ?? []) {
      const features = [
        ...(cls.classFeatures ?? []).map((entry) => entry.definition),
        ...(cls.definition?.classFeatures ?? []),
      ];
      for (const feature of features) {
        if (!feature?.name || (feature.requiredLevel ?? 0) > cls.level) continue;
        for (const rule of feature.creatureRules ?? []) {
          if (rule.creatureGroupId == null) continue;
          const current = sources.get(rule.creatureGroupId);
          if (!current || feature.name.length < current.length) sources.set(rule.creatureGroupId, feature.name);
        }
      }
    }
    const sizes: Record<number, string> = { 2: 'Tiny', 3: 'Small', 4: 'Medium', 5: 'Large', 6: 'Huge', 7: 'Gargantuan' };
    const types: Record<number, string> = {
      1: 'Aberration', 2: 'Beast', 3: 'Celestial', 4: 'Construct', 6: 'Dragon', 7: 'Elemental',
      8: 'Fey', 9: 'Fiend', 10: 'Giant', 11: 'Humanoid', 13: 'Monstrosity', 14: 'Ooze', 15: 'Plant', 16: 'Undead',
    };
    const movementNames: Record<number, string> = { 1: '', 2: 'Burrow', 3: 'Climb', 4: 'Fly', 5: 'Swim' };
    const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;
    for (const creature of raw.creatures ?? []) {
      const def = creature.definition;
      const name = creature.name?.trim() || def?.name?.trim();
      if (!def || !name) continue;
      const entry: CompanionEntry = {
        name, source: sources.get(creature.groupId ?? -1) ?? 'Selected Extras', abilities: [], details: [],
      };
      const meta = [sizes[def.sizeId ?? -1], types[def.typeId ?? -1]].filter(Boolean).join(' ');
      if (meta) entry.meta = meta;
      if (def.armorClass != null) entry.armorClass = [def.armorClass, def.armorClassDescription].filter((value) => value != null && value !== '').join(' ');
      if (def.averageHitPoints != null) entry.hitPoints = `${def.averageHitPoints}${def.hitPointDice?.diceString ? ` (${def.hitPointDice.diceString})` : ''}`;
      const cr = def.challengeRatingId;
      if (cr != null && cr >= 1) entry.challengeRating = cr <= 4 ? ['0', '1/8', '1/4', '1/2'][cr - 1] : String(cr - 4);
      const speed = (def.movements ?? []).filter((movement) => movement.speed != null && movement.speed > 0)
        .map((movement) => [movementNames[movement.movementId ?? 1], `${movement.speed} ft.`, movement.notes].filter(Boolean).join(' ')).join('; ');
      if (speed) entry.speed = speed;
      for (const stat of def.stats ?? []) {
        const ability = ABILITIES.find((entry) => entry.id === stat.statId);
        if (!ability || stat.value == null) continue;
        const savingThrow = (def.savingThrows ?? []).find((save) => save.statId === stat.statId);
        const save = savingThrow?.bonus ?? savingThrow?.value;
        entry.abilities.push({
          key: ability.key.toUpperCase(), score: String(stat.value), modifier: signed(abilityModifier(stat.value)),
          ...(save == null ? {} : { save: signed(save) }),
        });
      }
      const details: [string, string | null | undefined][] = [
        ['Details', creature.description], ['Traits', def.specialTraitsDescription], ['Actions', def.actionsDescription],
        ['Bonus Actions', def.bonusActionsDescription], ['Reactions', def.reactionsDescription],
        ['Legendary Actions', def.legendaryActionsDescription], ['Mythic Actions', def.mythicActionsDescription],
        ['Characteristics', def.characteristicsDescription],
      ];
      for (const [section, html] of details) {
        if (!html) continue;
        const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => match[1]);
        for (const paragraph of paragraphs.length ? paragraphs : [html]) {
          const labeled = leadingLabel(paragraph, this.text);
          const text = this.text(paragraph);
          if (text) entry.details.push({ section, label: labeled?.label ?? '', text: labeled?.rest ?? text });
        }
      }
      const languages = this.text([def.languageDescription, def.languageNote].filter(Boolean).join(' '));
      if (languages) entry.details.push({ section: 'Statistics', label: 'Languages', text: languages });
      if (def.passivePerception != null) entry.details.push({ section: 'Statistics', label: 'Senses', text: `Passive Perception ${def.passivePerception}` });
      this.addCompanion(entry);
    }
  }

  private mechanicsKey(text: string): string {
    return this.contentKey(text).match(/\p{L}+|\d+|[+-]/gu)?.join(' ') ?? '';
  }

  private addCompanion(entry: CompanionEntry, owner: string | number = entry.source): void {
    const key = JSON.stringify({
      owner: this.ownerKey(owner),
      values: [entry.name, entry.meta, entry.armorClass, entry.hitPoints, entry.speed, entry.challengeRating]
        .map((value) => this.mechanicsKey(value ?? '')),
      abilities: entry.abilities.map((ability) => [ability.key, ability.score, ability.modifier, ability.save]
        .map((value) => this.mechanicsKey(value ?? '')).join('|')).sort(),
    });
    const variants = this.#companionsByIdentity.get(key) ?? [];
    const detailKey = (detail: CompanionEntry['details'][number]) =>
      this.mechanicsKey(`${detail.label} ${detail.text}`);
    const fullKey = (details: CompanionEntry['details']) => details.map(detailKey).join(' ');
    const incomingText = fullKey(entry.details);
    const current = variants.find((candidate) => {
      const currentText = fullKey(candidate.details);
      if (currentText.includes(incomingText) || incomingText.includes(currentText)) return true;
      const shared = entry.details.filter((detail) => detail.label).flatMap((detail) => {
        const other = candidate.details.find((existing) =>
          this.mechanicsKey(existing.label) === this.mechanicsKey(detail.label));
        return other ? [[detailKey(detail), detailKey(other)]] : [];
      });
      const actionLabels = (details: CompanionEntry['details']) => details
        .filter((detail) => /actions|reactions/i.test(detail.section) && detail.label)
        .map((detail) => this.mechanicsKey(detail.label)).sort().join('|');
      return actionLabels(candidate.details) === actionLabels(entry.details) && shared.length > 0 &&
        shared.every(([a, b]) => a.includes(b) || b.includes(a));
    });
    if (!current) {
      variants.push(entry);
      this.#companionsByIdentity.set(key, variants);
      this.companions.push(entry);
      return;
    }
    for (const detail of entry.details) {
      const incoming = detailKey(detail);
      const existingText = fullKey(current.details);
      if (existingText.includes(incoming)) continue;
      const index = detail.label ? current.details.findIndex((old) =>
        this.mechanicsKey(old.label) === this.mechanicsKey(detail.label) && incoming.includes(detailKey(old))) : -1;
      if (index >= 0) {
        current.details[index] = detail;
        continue;
      }
      const text = detail.text.split(/(?<=[.!?])\s+(?=[A-Z])/)
        .filter((sentence) => !existingText.includes(this.mechanicsKey(sentence))).join(' ');
      if (text) current.details.push({ ...detail, text });
    }
    current.details = current.details.filter((detail, index, details) =>
      detail.label || !details.some((other, otherIndex) =>
        (other.label || otherIndex < index) && otherIndex !== index &&
        this.mechanicsKey(other.text).includes(this.mechanicsKey(detail.text))));
  }

  extract(html: string, source: string, owner: string | number = source): { html: string; related?: SectionKey[] } {
    let remaining = html;
    const related: SectionKey[] = [];
    for (const block of statBlocks(html).reverse()) {
      const entry = companion(block.html, source, this.text);
      if (!entry) continue;
      this.addCompanion(entry, owner);
      remaining = remaining.slice(0, block.start) + ' ' + remaining.slice(block.end);
      if (!related.includes('companions')) related.push('companions');
    }
    remaining = remaining.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (table: string, _body: string, offset: number) => {
      const parsed = tableGrid(table, this.text);
      let dataRows = parsed.rows;
      if (!dataRows.length) return table;
      const columns = parsed.columns;
      const caption = /<caption\b[^>]*>([\s\S]*?)<\/caption>/i.exec(table)?.[1];
      const precedingHeading = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>\s*$/i.exec(remaining.slice(0, offset))?.[1];
      const title = this.text(caption ?? precedingHeading ?? source) || source;
      const catalog = this.#selectedCatalogs.get(this.contentKey(title.replace(/\s*\([^)]*\)\s*$/, '')));
      if (catalog) {
        dataRows = dataRows.filter((row) => catalog.has(this.contentKey(row[0] ?? '')));
        if (!dataRows.length) return ' ';
      }
      const entry: RuleTable = {
        title,
        source, columns, rows: dataRows,
      };
      const key = JSON.stringify({
        owner: this.ownerKey(owner),
        columns: columns.map((cell) => this.contentKey(cell)),
        rows: dataRows.map((row) => row.map((cell) => this.contentKey(cell))),
      });
      if (!this.#tableKeys.has(key)) {
        this.#tableKeys.add(key);
        this.tables.push(entry);
      }
      if (!related.includes('tables')) related.push('tables');
      return ' ';
    });
    return { html: remaining, ...(related.length ? { related } : {}) };
  }
}
