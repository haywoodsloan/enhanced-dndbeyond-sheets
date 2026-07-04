# Enhanced D&D Beyond Sheets

A browser extension that produces a customizable, print-friendly layout of a D&D Beyond character sheet.

D&D Beyond's on-screen character sheet is not bad, but its default print output is cramped in some areas and wastes space in others. This extension opens a character in a separate view where sheet sections can be reordered, hidden, and printed, with a better default layouts.

Built with WXT and Vue 3.

## Status

Early development. Working now:

- Project scaffold (WXT + Vue 3 + TypeScript).
- Unit and integration test harness (Vitest).
- Character data layer: fetch a public character by id and normalize it into an internal model with per-section metadata.
- Activation: a toolbar icon and a right-click menu on a D&D Beyond character page open the enhanced sheet in a new tab, carrying the character id.

Not yet implemented, in planned order:

1. Enhanced-sheet tab (render sections).
2. Class-aware default ordering and auto-hide of empty sections.
3. Drag-and-drop customization with saved layouts.
4. Section content (attributes, inventory, spells, attacks, features).
5. Print layout.
6. Polish and customization.

End-to-end and visual tests are planned for a later phase.

## How it works (planned)

1. Open a character on D&D Beyond (`https://www.dndbeyond.com/characters/<id>`).
2. Activate the extension from the toolbar icon or the page context menu.
3. The extension opens a new tab and loads the character by ID from D&D Beyond's public character endpoint (`https://character-service.dndbeyond.com/character/v5/character/<id>`). The character must be set to public.
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
