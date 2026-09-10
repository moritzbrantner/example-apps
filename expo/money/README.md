# Money

A local-first single-currency personal ledger.

## MVP contract

- Record income and expenses as integer cents, never floating-point money.
- Categorize entries and add an optional note.
- Show overall balance plus current-month income and spending.
- Delete incorrect entries and persist the ledger locally with AsyncStorage.
- Use EUR as the fixed ledger currency in this slice.
- No bank connection, budgeting engine, investment tracking, or exchange-rate conversion.

## Example-app boundary

This repository owns the concrete ledger behavior and its tests. Store-release scaffolding and fleet release machinery remain owned by `expo-template`.

The legacy AsyncStorage key is intentionally preserved so repository migration does not strand an existing ledger.

## Local checks

```sh
bun run verify
```
