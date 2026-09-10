# Everyday interoperability v1

The everyday example apps remain independently installable and own their own domain state. They interoperate through small explicit intents instead of sharing a mutable database or importing one another at runtime.

## Ownership

- `inventory` owns household items, quantities, storage locations, and item identifiers.
- `borrowed` owns borrowing/lending records and return history.
- `maintenance` owns maintenance schedules and completion history.
- A foreign id is an opaque reference only. Receiving an id never transfers lifecycle authority to another app.

## Handoffs

The first contract uses platform deep links because they work without accounts or a shared backend:

- `borrowed://add?itemId=<inventory-item-id>&name=<item-name>` starts a loan record from an Inventory item.
- `maintenance://add?itemId=<inventory-item-id>&name=<item-name>&location=<optional-location>` starts a maintenance asset from an Inventory item.
- `inventory://open?itemId=<inventory-item-id>` returns to the authoritative Inventory item.

Receivers validate required values and ignore malformed handoffs. Human-readable names and locations are convenience context; the source id remains the cross-app reference.

## Evolution

Compatible optional query parameters may be added to v1. An incompatible semantic change requires a new explicit contract rather than silently reinterpreting an existing intent.

Future apps should add intents only when a real workflow needs them. In particular, Todo and Shopping handoffs should be added once those apps live in this repository, rather than inventing contracts in advance.
