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

## Interoperability

Everyday apps remain separate authorities but can exchange bounded intents through the [`everyday interoperability v1`](contracts/everyday-interop-v1.md) contract. This keeps app-to-app workflows explicit without introducing a hidden shared runtime dependency.

## Migration rule

Examples should remain independently understandable and should not become hidden dependencies of their source templates. Port application behavior and application-owned tests; leave template-specific release, scaffolding, and fleet infrastructure with the template unless an example genuinely needs it.

Ports are intentionally incremental so each application can establish a clean ownership boundary before the next one moves. Each port must pass the repository's exact-head validation before integration.
