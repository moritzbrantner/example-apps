# Example apps agent guidance

## Repository boundary

- Keep this repository a collection of concrete applications that consume and dogfood reusable foundations. Example applications must not become hidden dependencies of their source templates.
- Keep each application independently understandable and authoritative for its own product/domain behavior. Do not move unrelated app semantics into the fleet root merely to remove duplication.
- Keep the root package limited to fleet-level validation and maintenance orchestration; it is not a shared application runtime or dependency workspace.
- Preserve the bounded `contracts/everyday-interop-v1.md` seam for cross-app intents. Do not introduce a hidden shared runtime or database between applications.
- Prefer existing foundational repositories and explicit adapters when an app needs reusable capabilities; do not rebuild rendering, media, spatial, persistence, or other shared foundations locally without a concrete reason.

## Deterministic work

- Use the exact Bun version declared by the root and app `packageManager` fields.
- Treat each app-local `bun.lock` as authoritative for that app's dependency graph. CI and acceptance must install each app with `bun install --frozen-lockfile`.
- Treat `.coding-tooling.json` as the executable fleet validation contract. The root scripts remain the repository-owned capability implementations; hosted CI delegates tier selection and execution to an exact `coding-tooling` revision after the app-local dependency graphs are prepared.
- Use the revision-pinned `coding-tooling` Pages surface for zero-install structural preflight when useful. Pages evidence is non-executing and does not replace local validation or exact-head hosted CI.
- Keep app-local `test`, `typecheck`, and `build` scripts meaningful and directly runnable; the root runner orchestrates them but does not redefine their semantics.
- Keep Renovate as the single dependency updater for this repository.

## Acceptance

- For app/domain changes, run the affected app's narrow tests first and then the root validation path through the declared `coding-tooling` tier.
- Domain logic that can be tested without React Native should have focused deterministic tests next to the domain module.
- Do not weaken app behavior, skip an app, loosen dependency ranges, or add placeholder checks merely to make the fleet validation green.
- Use exact-head hosted CI as the final acceptance evidence before integration.
