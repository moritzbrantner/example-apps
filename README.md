# Example apps

Concrete applications that consume and dogfood the reusable templates without becoming part of the template contract.

## Structure

- `expo/` — Expo / React Native example applications
- `tauri/` — Tauri desktop example applications

## Apps

### Expo

- [`converter`](expo/converter) — offline deterministic unit converter, ported from `expo-template`

## Migration rule

Examples should remain independently understandable and should not become hidden dependencies of their source templates. Port application behavior and application-owned tests; leave template-specific release, scaffolding, and fleet infrastructure with the template unless an example genuinely needs it.

Ports are intentionally incremental so each application can establish a clean ownership boundary before the next one moves.
