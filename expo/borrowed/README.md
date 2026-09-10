# Borrowed & Lent

A local-first record of things shared between people.

## MVP contract

- Record something you lent or borrowed, the other person's name, an optional return date, and a note.
- Accept item handoffs from Household Inventory through `borrowed://add?itemId=…&name=…`.
- Keep an optional inventory reference without copying or owning inventory quantity.
- Open the linked source item again with `inventory://open?itemId=…`.
- Mark a loan returned idempotently and retain simple local history.
- Persist records on-device with AsyncStorage.
- No account, contact harvesting, social graph, feed, analytics, ads, or cloud dependency.

## Boundary

This app owns loan history. Household Inventory remains authoritative for the physical item and its quantity.

## Local checks

```sh
bun run verify
```
