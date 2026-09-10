# Unit Converter

A fast, offline unit converter for common everyday measurements.

This app was ported from `moritzbrantner/expo-template` at `e20a373224fe635d72db5c15af15e990aed4dfdd`. It now lives here as an example application so its domain behavior can evolve without becoming part of the Expo template contract.

## MVP contract

- Convert length, mass, temperature, volume, and speed.
- Switch units without a network request or account.
- Swap source and target units while preserving the represented quantity.
- Keep conversion formulas in a pure TypeScript module with deterministic tests.
- Accept either `.` or `,` as the decimal separator for input.

## Boundaries

Currency is intentionally excluded because exchange rates are time-dependent and would violate the offline deterministic contract.

Template-owned store/release automation is intentionally not copied into this example. The app keeps only the runtime, build, typecheck, and test surface it needs to demonstrate the product behavior.

## Local checks

```sh
bun install
bun run verify
```
