# Home Maintenance

A local-first maintenance record for household assets.

## MVP contract

- Add a maintained item with location, interval in days, notes, and an optional Household Inventory reference.
- Accept inventory handoffs through `maintenance://add?itemId=…&name=…&location=…`.
- Record maintenance completion with an optional note.
- Make same-day completion idempotent.
- Derive the next due date from the latest explicit completion record and configured interval.
- Open the linked inventory item again through `inventory://open?itemId=…`.
- Persist the maintenance record on-device with AsyncStorage.
- No account, analytics, ads, vendor service, predictive-failure claim, or cloud dependency.

## Boundary

Home Maintenance owns maintenance history and schedule derivation. Household Inventory owns the physical item and quantity.

## Local checks

```sh
bun run verify
```
