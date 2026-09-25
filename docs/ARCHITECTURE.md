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

The sheet uses fixed physical page dimensions converted to CSS pixels. Each card receives a footprint, optional saved anchor, and layout variant. The packer places anchored cards first, flows unanchored cards into available cells, and keeps continuations after their base card. Content-fit cards are measured in the browser and split at supported item boundaries; row-aligned rendering is the fallback when masonry columns cannot be sliced safely. A single rules block taller than a whole page gets internal bullet/text-line boundaries so its tail is not clipped.

Keep packing and continuation utilities pure. Browser measurement belongs in the sheet/component layer, and persisted layout data should remain independent of measured pixels so profiles survive page-format changes.

Fixed-card alternatives are measured in inert, off-screen probes before their layout toggle is enabled. Small paper uses fewer portrait columns to retain readable widths. Expanded spell cards also report natural content height. A saved card position is revalidated against the current page size so content growth cannot make it cross a page boundary.

## Concurrent sheets and persistence

Profile metadata edits rebase onto current storage under an extension-origin Web Lock, and open sheets consume metadata storage-change events. A failed transactional read aborts rather than overwriting saved profiles with a display fallback. Profile-scoped reads use generation checks; a late read cannot replace the currently selected profile. Duplication flushes local edits and waits for other sheets' reserved debounced-write locks before taking its snapshot; a timed-out copy does not publish a new profile.

Authorization capture and conditional invalidation share a separate Web Lock. A delayed rejected request can clear only its own credential, never a newer captured value. Credentials remain exclusively in `storage.session`; locks do not require an additional extension permission.

## Extending the model

To add a section:

1. Add its key and normalized data to `model.ts`.
2. Populate it in `normalize.ts` and add focused payload tests.
3. Add a card under `components/cards/` and register it in `SectionCard.vue`.
4. Define its layouts/order in `utils/layout/`.
5. Add component and layout coverage; add Playwright coverage if physical geometry changes.

Prefer source-aware, data-driven normalization over character-, class-, or spell-name exceptions. Preserve full rules prose when compact metadata cannot represent a mechanic accurately.
