# Example apps agent guidance

## Repository boundary

- Keep this repository a collection of concrete applications that consume and dogfood reusable foundations. Example applications must not become hidden dependencies of their source templates.
- Keep each application independently understandable and authoritative for its own product/domain behavior. Do not move unrelated app semantics into the workspace root merely to remove duplication.
- Keep the root workspace limited to fleet-level dependency resolution, deterministic validation, and maintenance automation.
- Preserve the bounded `contracts/everyday-interop-v1.md` seam for cross-app intents. Do not introduce a hidden shared runtime or database between applications.
- Prefer existing foundational repositories and explicit adapters when an app needs reusable capabilities; do not rebuild rendering, media, spatial, persistence, or other shared foundations locally without a concrete reason.

## Deterministic work

- Use the exact Bun version declared by the root `packageManager` field.
- Treat the root `bun.lock` as the authoritative dependency graph for the Expo workspace. CI and acceptance must install it with `bun install --frozen-lockfile`.
- Run repository validation through the root `test`, `typecheck`, and `build` scripts so every Expo app is covered by the same deterministic fleet path.
- Keep app-local `test`, `typecheck`, and `build` scripts meaningful and directly runnable; the root runner orchestrates them but does not redefine their semantics.
- Keep Renovate as the single dependency updater for this repository.

## Acceptance

- For app/domain changes, run the affected app's narrow tests first and then the root validation path.
- Domain logic that can be tested without React Native should have focused deterministic tests next to the domain module.
- Do not weaken app behavior, skip an app, loosen dependency ranges, or add placeholder checks merely to make the fleet validation green.
- Use exact-head hosted CI as the final acceptance evidence before integration.
