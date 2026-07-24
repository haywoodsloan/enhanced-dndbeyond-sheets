# Architecture

Beyond+ is a browser extension with three entrypoints and no server-side runtime.

## Data flow

1. `src/entrypoints/background.ts` observes D&D Beyond character-service requests and stores the current authorization header in `storage.session`.
2. The popup or context menu extracts a numeric character id and opens `sheet.html`.
3. `fetch-character.ts` requests that character directly from `character-service.dndbeyond.com`.
4. `normalize.ts` converts the unstable API payload into the stable model in `model.ts`.
5. Vue card components consume only the normalized model.
6. `App.vue` plans card sizes, packs them into physical page grids, and creates continuation cards for content that exceeds one printable card.

The extension has no production dependency on MCP or any project-owned backend.

The D&D Beyond source boundary is documented in [NORMALIZATION.md](NORMALIZATION.md). That runbook maps raw fields to the stable model and defines how to capture, sanitize, adapt, and validate a replacement payload after an API or webpage overhaul.

## Ownership boundaries

- `services/dndbeyond/`: authentication storage, API types, fetching, and normalization. Raw API details should not leak beyond this directory.
- `components/cards/`: presentation of one normalized section. Cards do not fetch or persist data.
- `utils/layout/`: pure page geometry, packing, section spans, ordering, and continuation calculations.
- `composables/`: browser/UI lifecycle such as character loading, drag behavior, profiles, and persisted refs.
- `utils/settings/`: preference keys and storage adapters. Character payloads and credentials do not belong here.

## Layout pipeline

The sheet uses fixed physical page dimensions converted to CSS pixels. Each card receives a footprint, optional saved anchor, and layout variant. The packer places anchored cards first, flows unanchored cards into available cells, and keeps continuations after their base card. Content-fit cards are measured in the browser and split only at supported item boundaries; row-aligned rendering is the fallback when masonry columns cannot be sliced safely.

Keep packing and continuation utilities pure. Browser measurement belongs in the sheet/component layer, and persisted layout data should remain independent of measured pixels so profiles survive page-format changes.

## Extending the model

To add a section:

1. Add its key and normalized data to `model.ts`.
2. Populate it in `normalize.ts` and add focused payload tests.
3. Add a card under `components/cards/` and register it in `SectionCard.vue`.
4. Define its layouts/order in `utils/layout/`.
5. Add component and layout coverage; add Playwright coverage if physical geometry changes.

Prefer source-aware, data-driven normalization over character-, class-, or spell-name exceptions. Preserve full rules prose when compact metadata cannot represent a mechanic accurately.
