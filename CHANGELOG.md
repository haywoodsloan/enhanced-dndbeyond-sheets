# Changelog

This project follows [Semantic Versioning](https://semver.org/). User-visible changes will be recorded here once releases are published.

## 0.1.0 - Unreleased

### Added

- Customizable, profile-based printable character-sheet layouts.
- Source-aware character normalization, actions, features, spells, companions, and continuation cards.
- Chrome and Firefox MV3 builds with unit, coverage, and browser layout tests.
- Automated lint, type, test, build, dependency, and Playwright checks in CI.
- A normalization contract and migration runbook for future D&D Beyond payload and webpage overhauls.
- Local and CI configuration for PrimeUI license verification without committing the key.

### Changed

- Updated all direct dependencies, including PrimeVue 5 with `@primeuix/themes` and the latest Vue-compatible TypeScript 6 release.
- Character loading now cancels superseded requests, clears stale data, and offers actionable retry guidance.
- Authorization capture now recovers correctly after a rejected session token is cleared.
- Production builds disable diagnostic logging; portrait URLs are restricted to HTTPS.
- Project setup, architecture, privacy, contribution, and release expectations are documented.
