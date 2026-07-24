# Security and privacy

## Supported version

Security fixes target the latest code on `main` until versioned releases begin. After releases begin, only the latest release line will be supported unless its notes say otherwise.

## Reporting a vulnerability

Do not open a public issue for a suspected credential, permission, or data-exposure vulnerability. Use GitHub's private vulnerability reporting for this repository. Include the affected version or commit, reproduction steps, impact, and any suggested mitigation. Do not include a real D&D Beyond authorization header or private character payload.

## Trust boundary

Beyond+ runs entirely in the browser and connects only to the D&D Beyond hosts declared in `wxt.config.ts`.

- It captures the signed-in user's D&D Beyond authorization header from the site's own character-service request.
- That header is stored only in `browser.storage.session`, is used only for direct character-service requests, and is cleared when rejected or when the browser session ends.
- Character payloads are normalized and rendered locally; they are not persisted or sent to project-owned infrastructure, analytics, or MCP services.
- Layout preferences and profile metadata are stored with browser sync storage and contain no character payload or credential.
- Production builds disable diagnostic console logging. Development logs redact sensitive keys and bearer/JWT-shaped values.

The PrimeUI license is supplied through `WXT_PRIMEUI_LICENSE` in an ignored `.env.local` file or a CI secret. It is embedded in the client bundle for offline verification, so it must not be treated as a server-side secret or used for unrelated authorization.

Any change to host permissions, credential storage, logging, external requests, or rendered HTML requires explicit security review and focused tests.
