# Everyday interoperability v1

The everyday example apps remain independently installable and own their own domain state. They interoperate through small explicit intents instead of sharing a mutable database or importing one another at runtime.

## Ownership

- `inventory` owns household items, quantities, storage locations, and item identifiers.
- `borrowed` owns borrowing/lending records and return history.
- `maintenance` owns maintenance schedules and completion history.
- `documents` owns imported household files plus their document metadata.
- `chores` owns household responsibility, assignment/rotation, and chore completion state.
- A foreign id is an opaque reference only. Receiving an id never transfers lifecycle authority to another app.

## Handoffs

The contract uses platform deep links because they work without accounts or a shared backend:

- `borrowed://add?itemId=<inventory-item-id>&name=<item-name>` starts a loan record from an Inventory item.
- `maintenance://add?itemId=<inventory-item-id>&name=<item-name>&location=<optional-location>` starts a maintenance asset from an Inventory item.
- `inventory://open?itemId=<inventory-item-id>` returns to the authoritative Inventory item.
- `documents://add?source=<source-app>&sourceId=<source-id>&label=<human-label>` starts a document record linked to an Inventory item or Maintenance asset.
- `chores://add?source=maintenance&sourceId=<asset-id>&title=<chore-title>&dueOn=<optional-date>` starts a household chore from a maintenance responsibility.
- `chores://import?data=<encoded-board-snapshot>` stages a shared Chores board snapshot for explicit user acceptance; receiving it never silently overwrites local state.

Receivers validate required values and ignore malformed handoffs. Human-readable names, labels, and dates are convenience context; source ids remain opaque references and source applications remain authoritative for their own domain objects.

## Evolution

Compatible optional query parameters may be added to v1. An incompatible semantic change requires a new explicit contract rather than silently reinterpreting an existing intent.

Future apps should add intents only when a real workflow needs them. Todo and Shopping handoffs should be added once those apps live in this repository, rather than inventing contracts in advance.
