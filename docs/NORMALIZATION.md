# D&D Beyond Data Normalization

This document is the maintenance runbook for adapting Beyond+ when D&D Beyond changes its character payload, transport, or webpage architecture. The central rule is:

> Preserve the normalized `Character` contract whenever possible. Replace or adapt the unstable D&D Beyond input layer before changing cards, layout, or print code.

## Compatibility boundary

```text
D&D Beyond transport or webpage
  -> transport-specific response type
  -> source adapter (only when the source shape differs materially)
  -> RawCharacter (current ingestion DTO)
  -> normalizeCharacter
  -> Character (stable application model)
  -> cards, layout, profiles, and print
```

The shipped extension currently fetches the character-service endpoint directly. MCP may help inspect data during development, but it is never a runtime source and must not appear in production imports or dependencies.

The important files are:

| File | Responsibility |
| --- | --- |
| `fetch-character.ts` | Endpoint, request options, response envelope, and transport errors. |
| `auth-token.ts` and `background.ts` | Capture and session-only storage of D&D Beyond authorization. |
| `api-types.ts` | Partial types for fields consumed from the current source payload. |
| `normalize.ts` | Source interpretation, joins, derived game values, text extraction, and ownership. |
| `rule-artifacts.ts` | Balanced companion stat-block extraction and deduplicated printable tables/lists. |
| `model.ts` | Stable model consumed by every component and layout utility. |
| `dnd5e.ts` | Pure game rules and D&D Beyond dictionary IDs that are independent of transport. |
| `tests/fixtures/*.json` | Sanitized real payloads used as regression evidence. |
| `tests/dndbeyond/*.test.ts` | Focused normalization contracts and source-shape edge cases. |

Raw D&D Beyond values must not leak into components. If a card needs a raw field, first decide what stable concept it represents and add that concept to `model.ts`.

## Stable `Character` contract

`model.ts` is the application boundary. A replacement normalizer is complete only when it can produce the same semantic contract:

- Required arrays and objects are always present, even when empty.
- Optional fields are absent only when the concept genuinely does not apply.
- Ordering is deterministic: abilities, saves, skills, groups, and sections do not depend on object-key iteration from the source.
- Text is display-ready Markdown/plain text. Raw API HTML never reaches Vue components.
- Numeric game values are resolved rather than left as source expressions or placeholders.
- Features reference matching visible actions in their summary/parts instead of duplicating long mechanics.
- Limited-use resources use `max` with structured `recovery`/`alternateRecovery`, retaining `recharge` compatibility. Independently granted spell casts use source-labelled `featureUses`; legacy `uses` is displayed only when no richer pools are present.
- `sections` accurately describes normalized content and preserves required structural cards.
- No field contains unresolved `{{...}}` expressions, HTML tags, source-only IDs, or authorization data.

Changing this contract is a product/model migration, not a payload migration. Make that decision explicitly and update components, layout behavior, and tests separately.

## Current normalization phases

`normalizeCharacter` is an orchestrator. Its call order is intentional because later phases consume ownership and derived data from earlier phases.

1. **Identity and level**: summarize classes and total character level.
2. **Core prerequisites**: resolve abilities, movement, and the placeholder resolver used by rules text.
3. **Direct sections**: skills, senses, defences, proficiencies, inventory, and attacks.
4. **Actions**: resolve normal/custom actions, complete rules, and action-owned resources.
5. **Resources**: build feature resource pools, then remove pools already represented by actions.
6. **Spells**: resolve metadata, damage, higher-level rules, independent grants, class-specific casting profiles, and separate Pact Magic slots.
7. **Features and supporting rules**: group active features and selected options; preserve complete mechanics and extract companion statistics/lookup tables with references to their printable owners.
8. **Section metadata**: derive card counts, titles, and auto-hide state from normalized output.
9. **Optional identity**: attach race, background, portrait, and spellcasting only when available.

When rebuilding, port and validate these phases in this order. Starting with features or spells before abilities, class levels, component ownership, and placeholder resolution usually creates misleading downstream failures.

## Source-to-model map

| Normalized output | Current raw sources | Main owner in `normalize.ts` | Important fallback or derivation |
| --- | --- | --- | --- |
| Identity, classes, level | `id`, `name`, `classes`, `race`, `background` | `summarizeClasses`, final assembly | Level is the sum of class levels. |
| Abilities | `stats`, `bonusStats`, `overrideStats`, ability modifiers, character values | `resolveAbilities` | Overrides win; set-score effects establish a minimum. |
| Basics | HP fields, classes, race speeds, inventory armor, modifiers, conditions | `resolveBasics`, `resolveArmorClass`, movement helpers | AC, max HP, proficiency, and hit dice are derived. |
| Saves and skills | abilities, modifiers, character values, custom proficiencies | `resolveSavingThrows`, `resolveSkills` | Proficiency and custom bonuses are joined by subtype/value IDs. |
| Senses and defences | skills, race, custom senses/defence adjustments, modifiers | `resolveSenses`, `resolveDefences` | Passive scores are derived from normalized skills. |
| Proficiencies | source-grouped modifiers and custom proficiencies | `resolveProficiencies` | Skill modifiers are excluded from training lists. |
| Attacks | inventory definitions, custom actions, modifiers, abilities | `resolveAttacks`, `weaponAttack`, `customAttack` | To-hit, ability choice, proficiency, magic bonus, and damage bonus are derived. |
| Actions | source-grouped actions, custom actions, feature/resource IDs | `resolveActions` | Custom actions are adapted into the common action shape first. |
| Spellcasting | class definitions/rules, modifiers, class levels | `resolveSpellcasting` | Class-specific profiles share regular multiclass slots; Pact Magic pools remain separate. |
| Spells | `classSpells`, source-grouped `spells`, spell definitions/modifiers | `resolveSpells` | Duplicate grants merge; tiered upcasting remains full prose when shorthand is unsafe. |
| Resources | action/feature `limitedUse`, modifiers, class level | `resolveResourceMap`, `limitedUseToPool` | Action-owned pools are removed from duplicate feature display. |
| Features | class features, race traits, feats, selected options, background | `resolveFeatures` | Gate by owned identity and required level; keep hidden same-name upgrades. Catalog-origin feats require an explicit feat selection; cached options and descriptions alone are not evidence. |
| Inventory and wealth | inventory, custom items, currencies | `resolveInventory`, `resolveWealth` | Stable empty arrays/zero coin values are emitted. |
| Sections | all normalized collections | final `toSection` phase | Core sections remain structural; optional sections depend on content. |

### Rich rules and casting contract

- `Spellcasting.profiles` retains each casting class's source, ability, attack bonus, save DC, and special focus requirements. The flat fields remain for compatibility, not as a replacement for the other profiles.
- `Spellcasting.slots` contains regular slots; `pactSlots` contains separate source/level/maximum pools that recharge on a Short Rest.
- Expanded spell-card mode retains an aggregate casting summary for profiles, focus requirements, and regular/pact slots; expanding individual spells must not remove these shared rules.
- `SpellEntry.featureUses` retains independent source-labelled pools. Deduplicate repeated records of the same grant, not different grants sharing a spell name.
- `SpellEntry.castingSources` preserves class/grant-specific ability, attack, and save DC when spell names merge; class spell groups join through their character-class mapping ID. It is independent of free-cast resource pools.
- Source-grouped class spells may omit their casting ability. Resolve their owning class through the granted feature or selected-option parent chain, then reuse that class's profile rather than dropping the alternative casting source.
- Selected feature benefits keep their shared parent requirements and replacement permissions, without reintroducing descriptions of unselected alternatives. Grouped table headers resolve to leaf columns, including rowspan associations. Companion layout variants merge only under matching owner/statistics and compatible canonical mechanics; additional riders survive.
- An action's `diceString` can already include its `fixedValue`; count that constant once, while retaining additional ability modifiers and `damageBonus`.
- `Character.companions` and `ruleTables` own extracted supporting details. References must lead to a nonempty printed destination, and extraction must not discard independent surrounding rules.
- Filter structural class traits and language-selection scaffolding before extracting artifacts. Tables whose captions identify a selected-choice catalog retain only known rows; selected names remain in feature grants even when the catalog has no matching row. Play-time lookups such as Experimental Elixir, Tinker's Magic, and Fast Crafting keep all usable outcomes.
- Shared action/feature tables are keyed by their owning component and normalized cell content. Resolve D&D Beyond reference aliases (`[items]target;display[/items]`) to the display label before comparing or printing cells.
- Structured feature parts, lists, tables, and grants preserve the selected benefits. Empty snippets, repeated display names, or data-origin category tags alone do not establish that a selected rule is irrelevant.
- Preserve restrictions, drawbacks, resource recovery, and upgrade rules after long introductions. Page layout may split content; normalization must not truncate mechanical text to fit.

Full model support is not itself proof of every upstream rule. Compare representative source payloads and fresh official-sheet evidence, and report unavailable or ambiguous evidence explicitly.

## Raw payload conventions that may change

### Instance versus definition

D&D Beyond commonly separates character-specific state from reusable rules definitions:

- The instance carries selection state, `prepared`, `equipped`, `limitedUse`, or `componentId`.
- `definition` carries names, rules HTML, dice, properties, and dictionary metadata.

Do not flatten this distinction blindly. A new source may inline definitions or replace them with references that require a second lookup.

### Source-grouped collections

`actions`, `spells`, and `modifiers` are currently `Record<string, array | null>`, grouped under keys such as `class`, `race`, `feat`, `background`, and `item`. The normalizer generally flattens all groups, then uses IDs and semantic fields to restore ownership. A future array with an explicit `source` field should be adapted once at the boundary rather than forcing every resolver to understand both layouts.

### Numeric modifiers

- A null `value` is not necessarily zero: `statId` supplies an ability modifier, and `bonusTypes: [1]` supplies Proficiency Bonus. An otherwise unspecified bonus does not implicitly grant proficiency.
- `isGranted: false` does **not** mean inactive. Selected ability-score improvements use this value. Conversely, future-level class features and unselected option modifiers must not affect totals.
- A 2024 species (`race.isLegacy: false`) can retain obsolete racial ability-score bonuses. Ignore those racial bonuses while preserving background/feat increases and explicit ability overrides.
- Unarmored movement increments and the feature's level scale describe the same bonus, not two stacking grants. Armor/shield restrictions and custom speed overrides are applied separately.
- Selected activation options can change current totals, including unarmored AC bonuses. Restrictions limited to a particular roll, such as concentration saves, remain conditional rules rather than generic save bonuses. Explicit disabling conditions in the granting rules also matter.
- Ability-derived bonuses can specify a minimum in their own bonus clause. An unrelated resource-use minimum in the same feature must not clamp that bonus.

`tests/dndbeyond/parity-stats.test.ts` covers these semantics with small synthetic fixtures. Historical UI captures are useful regression evidence, but matching them is not a claim of fresh live-sheet parity.

### Roster comparison boundaries

The separate `ddb-sheet-parity` workspace project stores authenticated reference captures, annotations, and source payloads locally. They must not be copied into the shipped extension or committed as private fixtures. `local-roster-rules.test.ts` is an optional offline replay when that sibling data exists; portable coverage must also pass without it.

Compare semantic context, not only matching numbers. For example, a selected Bladesong can make the official CON-save row include its concentration-only bonus; the printed sheet keeps the unconditional save and documents the concentration bonus in the feature rules. Record the exact exception rather than exempting a subclass from all comparisons.

Capture success establishes that evidence exists, not that every mechanic is correct. Keep unobserved source-only actions, ambiguous tracker owners, source references, and other unresolved comparison candidates visible in the parity report. A full roster pass does not certify every possible equipment, multiclass, toggle, or future payload variant.

### Component ownership graph

`componentId` is the most important join key in the current payload. It connects:

- class/race/feat/option definitions;
- selected options to the feature that offered them;
- modifiers to their granting feature;
- actions and resource pools to their owner;
- feature-granted spells to their owner.

If the overhaul replaces numeric component IDs, find the new stable ownership key before porting features. Values may look correct while resources, granted spells, and action references silently attach to the wrong feature.

### Numeric dictionaries and magic numbers

Several source numbers are dictionary IDs, not game values. Current examples include:

- ability/stat IDs 1-6;
- condition, damage type, creature type, and size IDs;
- armor, weapon category, movement, sense, activation, and component IDs;
- `characterValues.typeId` and `valueId` records;
- limited-use reset types and proficiency levels.

Mappings live in `dnd5e.ts`, typed comments in `api-types.ts`, and small maps near the resolver that owns them. Re-verify every mapping from representative new payloads. Do not assume an unchanged label means an unchanged ID.

### Modifier strings

The current normalizer interprets `type`, `subType`, `friendlySubtypeName`, `restriction`, and related strings. These are effectively an undocumented vocabulary. During migration, inventory distinct values from several payloads before writing switch logic. Prefer semantic fields from the new source over reconstructing behavior from display labels.

### Rules HTML

Descriptions currently contain HTML, and normalization relies on structural conventions:

- `<p>` blocks separate rules paragraphs;
- `<strong>`/`<em>` mark named options and higher-level casting headings;
- `<table>` contains roll tables or structured choices;
- rules can contain dynamic `{{...}}` placeholders and formatting flags.

These parsers are isolated in `plainText`, `richText`, placeholder helpers, and feature/spell summary helpers. Preserve complete action/spell rules and readable table rows rather than truncating essential mechanics. If D&D Beyond moves to structured rich text, consume the structure directly and retire regex parsing one parser at a time.

### Spell and class progression

Source spell slots can come from class spell-rule rows, multiclass divisors/rounding, or pact progression. Keep pact and regular pools distinct. Spell damage scaling may represent an increment per slot or an absolute threshold. Preserve full higher-level prose unless the source explicitly describes a reliable per-level increment.

## Acquisition strategy after an overhaul

Use this preference order:

1. A JSON endpoint called by the official page.
2. GraphQL or another structured network response called by the official page.
3. Structured hydration/application state embedded in the page.
4. DOM extraction only as a last resort.

Inspect the Network panel before writing selectors. DOM text is already formatted, localized, truncated, and responsive; it is the least stable source for game semantics.

If the new source is semantically similar, introduce a versioned adapter:

```text
DdbCharacterResponseVNext
  -> adaptVNextCharacter(response)
  -> RawCharacter
  -> normalizeCharacter(raw)
```

This preserves tested normalization while the transport changes. Keep the adapter mechanical: rename fields, normalize nullability, rebuild source groups, and preserve ownership keys. Do not derive AC, slots, resources, or summaries there.

If the new source changes semantics enough that adapting would fabricate the old payload, define focused source interfaces and port resolvers behind the same `Character` output. Avoid one giant `RawCharacterVNext` type with every observed field. Model only fields actually consumed.

If DOM extraction becomes unavoidable, isolate selectors and DOM parsing under a new acquisition module. Its output must be structured data, and no selector/class name should enter `normalize.ts`, `model.ts`, or card components.

## Payload capture and sanitization

1. Use a test character created for development, not a player's private character.
2. Open browser DevTools, enable **Preserve log**, filter Network requests for `character`, and reload the official sheet.
3. Save only the response body. Do not use **Copy as cURL/fetch**, because it includes cookies or authorization headers.
4. Capture several materially different characters, not only one happy path.
5. Before committing a fixture, remove or replace names, IDs, avatar URLs, campaign data, notes, backstory, custom text, and other identifying content.
6. Keep the structural fields and rules definitions needed to reproduce the behavior under test.
7. Never commit authorization headers, cookies, request headers, or browser storage exports.

Useful PowerShell shape checks:

```powershell
$data = Get-Content .\new-payload.json -Raw | ConvertFrom-Json
$data.PSObject.Properties.Name | Sort-Object
$data.actions.PSObject.Properties.Name | Sort-Object
$data.modifiers.PSObject.Properties.Name | Sort-Object
```

Compare top-level keys between payload generations:

```powershell
$old = (Get-Content .\old.json -Raw | ConvertFrom-Json).PSObject.Properties.Name
$new = (Get-Content .\new.json -Raw | ConvertFrom-Json).PSObject.Properties.Name
Compare-Object ($old | Sort-Object) ($new | Sort-Object)
```

Key equality is only a starting point. Also compare nullability, arrays versus maps, ID types, definition/instance placement, HTML shape, and ownership links.

## Representative fixture matrix

The committed `noct.json` and `hest.json` fixtures cover a prepared divine caster and a known arcane caster. For a major payload migration, add sanitized fixtures or focused synthetic cases covering:

- a non-caster martial character;
- a prepared caster and a known caster;
- multiclass spell slots;
- pact magic;
- high-level cantrip and class scaling;
- selected optional class/race/feat choices;
- feature-granted spells and limited free casts;
- tables embedded in rules descriptions;
- custom actions, custom proficiencies, custom speeds/senses, and custom items;
- equipped armor, shields, finesse/ranged/thrown weapons, and magic bonuses;
- missing choices, null collections, and a minimal low-level character.

Prefer small synthetic payloads for one rule and sanitized real payloads for integration. Avoid giant snapshots as the only assertion: focused semantic expectations explain what broke.

## Migration runbook

### 1. Freeze the current contract

From a clean checkout, record the baseline:

```sh
npm run check
npm run test:coverage
npm run build
npm run build:firefox
npm run test:e2e
```

Keep old fixtures passing while adding new-source fixtures. They document expected semantics even if the old endpoint disappears.

### 2. Update transport separately

Change endpoint/GraphQL acquisition, host permissions, auth capture, and response-envelope validation before changing game normalization. Add fetch tests for success, auth failure, not found, malformed responses, and cancellation.

If hosts or request headers change, review `wxt.config.ts`, `background.ts`, `auth-token.ts`, `fetch-character.ts`, `SECURITY.md`, and store permission disclosures together.

### 3. Model the consumed source shape

Update `api-types.ts` or add a versioned source type. Keep source fields optional/nullable where observed. Avoid `any`; use `unknown` at untrusted boundaries and narrow it. A successful TypeScript cast is not runtime validation, so validate the transport envelope and any discriminator that controls parsing.

### 4. Port in dependency order

Port identity/classes first, then abilities and core basics. Continue through saves/skills, inventory/attacks, spellcasting/spells, actions/resources, features, and sections. Run focused tests after each phase.

### 5. Preserve semantic ownership

Before declaring features complete, verify:

- limited-use boxes appear once, on the correct action or feature;
- feature-granted spell trackers appear beside the spell in both list and expanded-card modes;
- selected options replace prompts rather than appearing as duplicate features;
- hidden/structural features and data-origin placeholders remain filtered;
- duplicate records merge without losing prepared state or independently recharging pools.

### 6. Compare normalized output

For equivalent old/new test characters, compare stable subsets of `Character`, not raw payload paths. Differences should reflect real game data changes, not source layout changes. Review arrays, ordering, summaries, resources, action references, section counts, and spellcasting values.

Keep or add invariant tests that reject:

- unresolved placeholders;
- raw HTML tags;
- `undefined`, `NaN`, or empty dynamic labels in serialized output;
- duplicate attacks/actions/spells caused by source grouping;
- past-level or unselected feature options;
- misleading compact scaling that disagrees with full rules text.

### 7. Validate rendering and print

Once normalized tests pass, run component and Playwright coverage. Payload changes often alter text length and card counts even when values are correct, so verify continuations, A5 layouts, expanded spell cards, page counts, and PDF output.

## Failure triage

| Symptom | Start here |
| --- | --- |
| Every character fails to load | Endpoint, host permission, auth capture, or response envelope. |
| Core identity loads but most sections are empty | Top-level collection names or array/map shape. |
| Values are present but numerically wrong | Dictionary IDs, modifiers, class levels, or definition/instance split. |
| Actions/features duplicate each other | Component ownership and resource deduplication. |
| Granted spells attach to the wrong feature | Component/option join keys. |
| Raw tags or run-on prose appear | HTML/rich-text structure changed. |
| `{{...}}` text appears | Placeholder grammar or context changed. |
| Spell slots or upcasting are wrong | Class spell rules, scale type, or threshold versus increment semantics. |
| Unit tests pass but print clips | Text length/card counts changed; run built-extension Playwright tests. |

## Definition of done

A payload migration is complete when:

- transport and auth tests cover the new acquisition path;
- source types describe every consumed field and no obsolete path remains in resolvers;
- the stable `Character` contract is preserved or intentionally versioned;
- representative real and synthetic fixtures pass focused semantic tests;
- serialized normalized output has no unresolved source markup or expressions;
- resources and cross-card ownership are correct and non-duplicated;
- coverage thresholds, Chrome/Firefox builds, and all Playwright print/layout tests pass;
- permissions, privacy documentation, architecture notes, and this runbook match the new source.

Update this document whenever a new raw convention, numeric dictionary, HTML parser, ownership join, or acquisition source is introduced.
