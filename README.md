# Example apps

Concrete applications that consume and dogfood the reusable templates without becoming part of the template contract.

## Structure

- `expo/` — Expo / React Native example applications
- `tauri/` — Tauri desktop example applications

## Apps

### Expo

- [`converter`](expo/converter) — offline deterministic unit converter, ported from `expo-template`
- [`contractions`](expo/contractions) — local-first contraction timing log, ported from `expo-template`
- [`books`](expo/books) — local-first reading library with ISBN scanning and optional Open Library metadata enrichment, ported from `expo-template`
- [`habits`](expo/habits) — local-first habit tracker without streak or engagement mechanics, ported from `expo-template`
- [`gifts`](expo/gifts) — private local-first gift tracker with explicit regift provenance, ported from `expo-template`
- [`money`](expo/money) — local-first EUR ledger using integer cents, ported from `expo-template`
- [`inventory`](expo/inventory) — local-first household inventory with barcode/QR scanning and explicit cross-app handoffs
- [`borrowed`](expo/borrowed) — local-first borrowing and lending records that can reference Inventory items
- [`maintenance`](expo/maintenance) — local-first maintenance history and due dates that can reference Inventory items
- [`documents`](expo/documents) — household document catalog with native managed-file import/export and source references
- [`church-documents`](expo/church-documents) — local-first Church document catalog with search, bookmarks, reading status, and provenance-preserving handoff to official texts
- [`chores`](expo/chores) — recurring household responsibilities with rotation and explicit shareable snapshots
- [`events`](expo/events) — event organization workboard for invitees, bring commitments, setup/general/cleanup work, and explicit shareable snapshots
- [`meetings`](expo/meetings) — collaborative meeting scheduler with guest-first attendance polling, bring reminders, and route-aware carpool matching

### Fine arts · Expo

- [`music-practice`](expo/music-practice) — local-first practice notebook with wall-clock timing and persistent native audio takes
- [`gregorian-chant`](expo/gregorian-chant) — local-first Gregorian chant library/practice foundation with GABC authority and explicit shared audio-analysis/player seams
- [`sketchbook`](expo/sketchbook) — local-first vector sketchbook with freehand drawing, brush controls, undo, and redo

The fine-arts examples intentionally start as small usable tools. Requirements such as instrument modeling, sheet music, tuning analysis, pressure-sensitive drawing, layers, references, and export should emerge from actual use before shared abstractions are introduced.

## Interoperability

Everyday apps remain separate authorities but can exchange bounded intents through the [`everyday interoperability v1`](contracts/everyday-interop-v1.md) contract. This keeps app-to-app workflows explicit without introducing a hidden shared runtime dependency.

## Migration rule

Examples should remain independently understandable and should not become hidden dependencies of their source templates. Port application behavior and application-owned tests; leave template-specific release, scaffolding, and fleet infrastructure with the template unless an example genuinely needs it.

Ports are intentionally incremental so each application can establish a clean ownership boundary before the next one moves. Each port must pass the repository's exact-head validation before integration.

## GitHub Pages

The Pages build keeps the catalog separate from the applications. The TypeScript overview is published at `/example-apps/`, while every Expo application is exported independently under `/example-apps/apps/<slug>/`.

`bun run build:pages` builds the overview, exports every app with its existing `EXPO_PUBLIC_GITHUB_PAGES_BASE_URL` seam, and then augments the result with the shared `github-pages-template` evidence routes. The deployment itself is delegated to `reusable-workflows`.

GitHub Pages exposes one site per repository, so these are isolated app subsites rather than independent DNS subdomains. Moving an app to a separate custom domain later does not require sharing runtime state or changing its product authority.
