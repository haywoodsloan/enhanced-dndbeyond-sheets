# Enhanced D&D Beyond Sheets

A browser extension that produces a customizable, print-friendly layout of a D&D Beyond character sheet.

D&D Beyond's on-screen character sheet is not bad, but its default print output is cramped in some areas and wastes space in others. This extension opens a character in a separate view where sheet sections can be reordered, hidden, and printed, with a better default layouts.

Built with WXT and Vue 3.

## Status

Functional. Implemented:

- Character data layer: fetch a character by id (public, or private via the signed-in user's session) and normalize it into an internal model with per-section metadata.
- Activation: a toolbar icon and a right-click menu on a D&D Beyond character page open the enhanced sheet in a new tab, carrying the character id.
- Enhanced sheet: renders every section (attributes, skills, saves, senses, proficiencies, actions, spells, inventory, wealth, features, notes, portrait) with a class-aware default layout and auto-hidden empty sections.
- Customization: drag any card to any grid cell (free positional placement), hide/show sections, and cycle a card's density — all persisted via `storage.sync`.
- Print: a page-accurate, paginated layout with selectable page size, margins, and theme color.
- Tests: unit/integration tests (Vitest) plus end-to-end drag tests (Playwright).

## How it works

1. Open a character on D&D Beyond (`https://www.dndbeyond.com/characters/<id>`).
2. Activate the extension from the toolbar icon or the page context menu.
3. While you use D&D Beyond, the extension captures the `Authorization` header from the site's own character-service requests and holds it in memory (`storage.session`, cleared when the browser closes, never written to disk). On activation it opens a new tab with the enhanced sheet, which fetches your character using that captured header — so **private characters load** and the sheet always reflects the character's latest state. Without a captured header only public characters load.
4. Sheet sections render in a class-aware default layout, with empty sections auto-hidden. Drag any card to any grid cell to place it freely; hide or show sections and cycle a card's density.
5. Adjust the page size, margins, and theme color, then print.

## Requirements

- Node.js 20.12 or newer.
- npm.

## Setup

```sh
npm install
```

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run in development mode (Chrome) with hot reload. |
| `npm run dev:firefox` | Run in development mode (Firefox). |
| `npm run build` | Production build (Chrome) to `.output/`. |
| `npm run build:firefox` | Production build (Firefox). |
| `npm run zip` | Package the build as a zip for store submission. |
| `npm test` | Run the unit/integration suite once. |
| `npm run test:watch` | Run tests in watch mode. |
| `npm run test:coverage` | Run the suite with a coverage report. |
| `npm run test:e2e` | Build, then run the Playwright end-to-end tests. |
| `npm run compile` | Type-check with `vue-tsc`. |

## Debugging

For active development, use the **Debug: WXT dev (Chrome)** or **Debug: WXT dev (Firefox)** launch configuration (Run and Debug panel): it runs the dev server with hot reload, and WXT launches the browser with the extension loaded. Debug the running extension with the browser's DevTools.

### Loading a production build

Recent Chrome no longer loads unpacked extensions from the command line, so load the build manually.

**Chrome**

1. Run the **Build production (Chrome)** task (Run Build Task, `Ctrl+Shift+B`) or `npm run build`.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `.output/chrome-mv3`.
3. After each rebuild, click the extension's **reload** button.

**Firefox**

1. Run the **Build production (Firefox)** task or `npm run build:firefox`.
2. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on**, and select `.output/firefox-mv3/manifest.json`.

## Project structure

```
src/               Application source (WXT srcDir; the @ alias points here)
  entrypoints/       Extension entrypoints (background, popup, sheet page)
  components/        Vue components
    SectionCard.vue    The card shell (drag handle, layout + visibility toggles)
    cards/             Per-section content cards (abilities, skills, spells, …)
  composables/       Vue composables (character load, layout, drag, FLIP)
  services/
    dndbeyond/         The D&D Beyond data layer (fetch, auth, normalize, model)
  utils/
    layout/            Grid packing, pagination, section order/spans
    character/         D&D 5e formatting and character summaries
    url/               Character- and sheet-URL parsing
    settings/          Persisted preferences and theme colors
    debug.ts           Redacting logger
modules/           Local WXT modules
public/            Static files copied as-is (icons)
tests/             Unit and integration tests (mirrors src/ layout)
e2e/               Playwright end-to-end tests
wxt.config.ts      WXT configuration (srcDir: 'src')
vitest.config.ts   Vitest configuration
playwright.config.ts  Playwright configuration
```

Generated and not committed: `.wxt/`, `.output/`, `node_modules/`.

## Testing

Unit and integration tests use Vitest with WXT's testing plugin and `@vue/test-utils`. They live in `tests/`, mirror the source layout, and are named `*.test.ts`. Run `npm test` for the suite, or `npm run test:coverage` for a coverage run — it prints a terminal summary and per-file table, writes a browsable report to `coverage/index.html`, and emits `coverage/lcov.info` for editors (e.g. Coverage Gutters) and CI. Coverage is measured against `src/` and gated by minimum thresholds in `vitest.config.ts`, so a regression fails the run.

The pointer-driven card drag needs a real layout engine, so it's covered by Playwright end-to-end tests in `e2e/` (named `*.spec.ts`) that load the built extension and drive the drag in a headless browser. Run them with `npm run test:e2e` (it builds first). These exercise the built bundle in a browser rather than `src/`, so they aren't part of the coverage report.
