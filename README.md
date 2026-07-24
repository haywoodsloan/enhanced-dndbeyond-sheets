# Enhanced D&D Beyond Sheets

A browser extension that produces a customizable, print-friendly layout of a D&D Beyond character sheet.

D&D Beyond's on-screen character sheet is not bad, but its default print output is cramped in some areas and wastes space in others. This extension opens a character in a separate view where sheet sections can be reordered, hidden, and printed with a better default layout.

Built with WXT and Vue 3.

## Status

The extension is functional and under active development. It currently provides:

- Character data layer: fetch a character by id (public, or private via the signed-in user's session) and normalize it into an internal model with per-section metadata.
- Activation: a toolbar icon and a right-click menu on a D&D Beyond character page open the enhanced sheet in a new tab, carrying the character id.
- Enhanced sheet: renders every section (attributes, skills, saves, senses, proficiencies, actions, spells, inventory, wealth, features, notes, portrait) with a class-aware default layout and auto-hidden empty sections.
- Customization: drag any card to any grid cell (free positional placement), hide/show sections, and cycle a card's density — all persisted via `storage.sync`.
- Print: a page-accurate, paginated layout with selectable page size, margins, and theme color.
- Tests: unit/integration tests (Vitest) plus end-to-end drag tests (Playwright).

Chrome/Chromium and Firefox MV3 builds are supported.

## How it works

1. Open a character on D&D Beyond (`https://www.dndbeyond.com/characters/<id>`).
2. Activate the extension from the toolbar icon or the page context menu.
3. While you use D&D Beyond, the extension captures the `Authorization` header from the site's own character-service requests and holds it in memory (`storage.session`, cleared when the browser closes, never written to disk). On activation it opens a new tab with the enhanced sheet, which fetches your character using that captured header — so **private characters load** and the sheet always reflects the character's latest state. Without a captured header only public characters load.
4. Sheet sections render in a class-aware default layout, with empty sections auto-hidden. Drag any card to any grid cell to place it freely; hide or show sections and cycle a card's density.
5. Adjust the page size, margins, and theme color, then print.

## Requirements

- Node.js 24 or newer (see `.nvmrc`).
- npm.

## Setup

```sh
npm install
```

### PrimeUI license

PrimeVue 5 requires a PrimeUI Community or Commercial license key. Keep the key in a local WXT environment file rather than source control:

```powershell
Copy-Item .env.example .env.local
```

Set the value in `.env.local`:

```dotenv
WXT_PRIMEUI_LICENSE=your-license-key
```

Restart the WXT development server after changing the file. Production builds read the same variable. For GitHub Actions, create a repository secret named `PRIMEUI_LICENSE`; the workflow maps it to `WXT_PRIMEUI_LICENSE` for browser builds and end-to-end tests.

PrimeUI verifies licenses offline in the browser, so the key is necessarily embedded in the compiled extension. Ignoring `.env.local` prevents accidental source-control disclosure but does not make a client-side key secret.

## Commands

| Command                 | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | Run in development mode (Chrome) with hot reload.    |
| `npm run dev:firefox`   | Run in development mode (Firefox).                   |
| `npm run build`         | Production build (Chrome) to `.output/`.             |
| `npm run build:firefox` | Production build (Firefox).                          |
| `npm run zip`           | Package the build as a zip for store submission.     |
| `npm test`              | Run the unit/integration suite once.                 |
| `npm run test:watch`    | Run tests in watch mode.                             |
| `npm run test:coverage` | Run the suite with a coverage report.                |
| `npm run test:e2e`      | Build, then run the Playwright end-to-end tests.     |
| `npm run compile`       | Type-check with `vue-tsc`.                           |
| `npm run lint`          | Run ESLint across source, tests, and configuration.  |
| `npm run check`         | Run lint, type-checking, and unit/integration tests. |

## Debugging

For active development, use the **Debug: WXT dev (Chrome)** or **Debug: WXT dev (Firefox)** launch configuration (Run and Debug panel): it runs the dev server with hot reload, and WXT launches the browser with the extension loaded. Debug the running extension with the browser's DevTools.

### Loading a production build

Recent Chrome no longer loads unpacked extensions from the command line, so load the build manually.

### Chrome

1. Run the **Build production (Chrome)** task (Run Build Task, `Ctrl+Shift+B`) or `npm run build`.
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `.output/chrome-mv3`.
3. After each rebuild, click the extension's **reload** button.

### Firefox

1. Run the **Build production (Firefox)** task or `npm run build:firefox`.
2. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on**, and select `.output/firefox-mv3/manifest.json`.

## Project structure

```text
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

## Runtime architecture

```text
D&D Beyond page
  -> background auth-header capture (storage.session only)
  -> extension sheet fetches character-service directly
  -> raw API payload normalization
  -> stable internal character model
  -> responsive card layout, pagination, and print output
```

The shipped extension calls D&D Beyond directly. It does not use or depend on an MCP server. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for ownership boundaries and extension points, and [docs/NORMALIZATION.md](docs/NORMALIZATION.md) for the payload contract and API-overhaul migration runbook.

## Privacy and permissions

Beyond+ processes character data locally in the browser. It does not send character data or credentials to this project, its maintainers, analytics services, or an MCP server.

- `webRequest` observes requests only to D&D Beyond's character service so the extension can capture the signed-in user's authorization header.
- The authorization header is stored in `storage.session`, is never written to disk by the extension, and is cleared when the browser session ends or D&D Beyond rejects it.
- `storage` persists layout preferences and profiles; it does not persist character payloads.
- `activeTab` reads the current tab URL only when the toolbar popup is opened.
- `contextMenus` provides the “Open enhanced character sheet” page action.

See [SECURITY.md](SECURITY.md) for the complete trust boundary and vulnerability-reporting guidance.

## Troubleshooting

- **Character not found:** confirm the URL is a D&D Beyond character page and that your account can view it.
- **Session expired or private character will not load:** refresh the character page on D&D Beyond so its own character request runs, then select Beyond+ again.
- **Network or rate-limit error:** wait briefly and use **Try again** on the sheet.
- **Layout did not persist:** browser sync storage may be unavailable or at quota. Check the extension console in a development build for a redacted storage diagnostic.
- **Production build appears stale:** reload the unpacked extension from the browser's extension-management page after rebuilding.

## Testing

Unit and integration tests use Vitest with WXT's testing plugin and `@vue/test-utils`. They live in `tests/`, mirror the source layout, and are named `*.test.ts`. Run `npm test` for the suite, or `npm run test:coverage` for a coverage run — it prints a terminal summary and per-file table, writes a browsable report to `coverage/index.html`, and emits `coverage/lcov.info` for editors (e.g. Coverage Gutters) and CI. Coverage is measured against `src/` and gated by minimum thresholds in `vitest.config.ts`, so a regression fails the run.

The pointer-driven card drag needs a real layout engine, so it's covered by Playwright end-to-end tests in `e2e/` (named `*.spec.ts`) that load the built extension and drive the drag in a headless browser. Run them with `npm run test:e2e` (it builds first). These exercise the built bundle in a browser rather than `src/`, so they aren't part of the coverage report.

GitHub Actions runs lint, type-checking, coverage-gated tests, Chrome and Firefox builds, a production dependency audit, and the Playwright suite for pushes and pull requests.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for project conventions, validation commands, and the release checklist. User-visible changes are summarized in [CHANGELOG.md](CHANGELOG.md).
Report suspected vulnerabilities through the private process in [SECURITY.md](SECURITY.md).
