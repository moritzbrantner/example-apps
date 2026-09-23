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


## Product UI

- Treat functional app screens as tools, not landing pages. Put the primary task, content, search/filter controls, and frequent actions in the first viewport; do not lead with recurring hero slogans or marketing-style explanatory copy.
- Do not add KPI, count, or summary cards merely to make a screen look like a dashboard. A metric belongs on the screen only when it changes a decision or helps complete the current task.
- Every persistent navigation item, icon, and action must correspond to a real frequent destination or task. Remove placeholder/decorative icons and avoid duplicating page identity with redundant navigation chrome.
- Prefer compact, information-dense mobile layouts over decorative whitespace. Use explanatory copy only where it resolves ambiguity at the point of action; move implementation rationale and product manifestos to README/About surfaces.
- Empty states should state what is missing and the next useful action, not sell or explain the product.

## Acceptance

- For app/domain changes, run the affected app's narrow tests first and then the root validation path through the declared `coding-tooling` tier.
- Domain logic that can be tested without React Native should have focused deterministic tests next to the domain module.
- Do not weaken app behavior, skip an app, loosen dependency ranges, or add placeholder checks merely to make the fleet validation green.
- Use exact-head hosted CI as the final acceptance evidence before integration.
