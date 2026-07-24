# Contributing

## Setup

Use Node 24 and install from the lockfile:

```sh
nvm use
npm ci
```

Copy `.env.example` to `.env.local` and set `WXT_PRIMEUI_LICENSE` before running or packaging PrimeVue 5. Never commit the populated file. CI reads the `PRIMEUI_LICENSE` repository secret.

Run `npm run dev` for Chrome or `npm run dev:firefox` for Firefox. The VS Code launch configurations provide the same development sessions.

## Conventions

- Use Vue Composition API with typed `<script setup>` components.
- Keep raw D&D Beyond shapes inside `services/dndbeyond`; UI code consumes the normalized model.
- Follow `docs/NORMALIZATION.md` for payload captures, source adapters, ownership joins, fixture sanitization, and API-overhaul migrations.
- Prefer existing layout, settings, and formatting helpers over parallel abstractions.
- Keep normalization generic and source-aware. Avoid name-specific rules unless the upstream payload offers no reliable semantic signal.
- Keep comments focused on non-obvious constraints, especially print geometry and API quirks.
- Do not add character payloads containing private or identifying data.
- Never log authorization values or character payloads. `debugLog` is development-only and redacts secret-shaped values.

## Validation

Before opening a pull request:

```sh
npm run check
npm run test:coverage
npm run build
npm run build:firefox
npm run test:e2e
npm audit --omit=dev
```

Use focused tests while iterating, then run the complete matrix for changes to normalization, shared components, layout, print output, auth, or persistence. Playwright tests run serially because each test owns a persistent browser context containing the built extension.

## Pull requests

- Explain the user-visible behavior and the controlling code path.
- Include focused regression coverage for bug fixes.
- Include screenshots only when visual comparison materially helps review.
- Update `README.md`, `docs/ARCHITECTURE.md`, or `CHANGELOG.md` when behavior, architecture, setup, or release expectations change.
- Keep generated directories (`.output`, `.wxt`, `coverage`, `test-results`) out of commits.

## Release checklist

1. Choose the next semantic version and update `package.json` and `CHANGELOG.md`.
2. Run the complete validation matrix above from a clean install.
3. Build and inspect both manifests and packaged zip files.
4. Smoke-test a public and private character in Chrome and Firefox.
5. Tag the release as `v<version>` and publish matching release notes.
6. Submit the generated browser-specific packages to their stores.
