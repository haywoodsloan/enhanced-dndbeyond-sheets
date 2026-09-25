# Changelog

This project follows [Semantic Versioning](https://semver.org/). User-visible changes will be recorded here once releases are published.

## 0.1.0 - Unreleased

### Added

- Customizable, profile-based printable character-sheet layouts.
- Source-aware character normalization, actions, features, spells, and continuation cards.
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

### Fixed

- Profile switching no longer applies stale reads; concurrent sheet tabs preserve each other's profile edits, and duplication includes pending card placements.
- Failed profile metadata reads cannot overwrite saved profiles, and duplication also waits for pending placements in other open sheets.
- Rejected old requests preserve newer authorization, and failed credential captures can retry.
- Malformed saved profile/placement entries no longer abort initialization.
- Saved cards stay within page boundaries, keyboard movement works, and continuation planning reacts to changed item boundaries.
- Small-page and expanded-spell measurements are connected to the sheet; unsafe feature columns use a row-aligned continuation fallback.
- Rules blocks taller than a page can continue at internal text boundaries, and spell levels containing only slots provide valid page breaks.
- Printed pages no longer retain the on-screen desk gap, and failed character loads offer a retry action.
- Normalization preserves complete action/spell rules, custom proficiencies, selected benefits, and feature-cast trackers in both spell views; ability, AC, HP, damage, and limited-use calculations have additional regression coverage.
- Patched transitive Nano ID and PostCSS dependencies; removed unused companion/table presentation components from the retained simplified model.
