# Enhanced D&D Beyond Sheets

A browser extension that produces a customizable, print-friendly layout of a D&D Beyond character sheet.

D&D Beyond's on-screen character sheet is not bad, but its default print output is cramped in some areas and wastes space in others. This extension opens a character in a separate view where sheet sections can be reordered, hidden, and printed, with a better default layouts.

Built with WXT and Vue 3.

## Status

Early development. Working now:

- Project scaffold (WXT + Vue 3 + TypeScript).
- Unit and integration test harness (Vitest).
- Character data layer: fetch a character by id (public, or private via the signed-in user's session) and normalize it into an internal model with per-section metadata.
- Activation: a toolbar icon and a right-click menu on a D&D Beyond character page open the enhanced sheet in a new tab, carrying the character id.
- Enhanced-sheet tab: loads the character and renders the list of sheet sections with entry counts (loading and error states handled).

Not yet implemented, in planned order:

1. Class-aware default ordering and auto-hide of empty sections.
2. Drag-and-drop customization with saved layouts.
3. Section content (attributes, inventory, spells, attacks, features).
4. Print layout.
5. Polish and customization.

End-to-end and visual tests are planned for a later phase.

## How it works (planned)

1. Open a character on D&D Beyond (`https://www.dndbeyond.com/characters/<id>`).
2. Activate the extension from the toolbar icon or the page context menu.
3. While you use D&D Beyond, the extension captures the `Authorization` header from the site's own character-service requests and holds it in memory (`storage.session`, cleared when the browser closes, never written to disk). On activation it opens a new tab with the enhanced sheet, which fetches your character using that captured header — so **private characters load** and the sheet always reflects the character's latest state. Without a captured header only public characters load.
4. Sheet sections are shown in a drag-and-drop layout. Default order depends on the character's class, empty sections are hidden, and hidden sections are placed at the end.
5. Adjust the layout and print.

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
| `npm test` | Run the test suite once. |
| `npm run test:watch` | Run tests in watch mode. |
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
entrypoints/      Extension entrypoints (background, sheet page)
components/       Vue components (auto-imported)
composables/      Vue composables (auto-imported)
utils/            Generic utilities (auto-imported)
modules/          Local WXT modules
services/         Framework-agnostic domain logic (D&D Beyond data layer)
assets/           Assets processed by the bundler
public/           Static files copied as-is (icons)
tests/            Unit and integration tests (mirrors source layout)
wxt.config.ts     WXT configuration
vitest.config.ts  Test configuration
```

Generated and not committed: `.wxt/`, `.output/`, `node_modules/`.

## Testing

Tests use Vitest with WXT's testing plugin and `@vue/test-utils`. Test files live in `tests/`, mirroring the source layout, and are named `*.test.ts`.
