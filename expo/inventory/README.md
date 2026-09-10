# Household Inventory

A local-first inventory for ordinary household objects and supplies.

## MVP contract

- Add named items with quantity, unit, physical location, low-stock threshold, barcode/QR value, and notes.
- Scan EAN/UPC/QR codes with the camera; an existing code opens the matching item and a new code prefills a new item.
- Adjust quantities without allowing negative stock.
- Surface low-stock items without engagement mechanics.
- Hand an inventory item to Borrowed & Lent or Home Maintenance through the everyday interoperability v1 URI contract.
- Accept `inventory://open?itemId=…` callbacks from linked apps.
- Persist inventory on-device with AsyncStorage.
- No account, analytics, ads, cloud dependency, or proprietary remote inventory service.

## Boundary

This app owns household inventory state. Borrowing and maintenance records remain authoritative in their own apps. Handoffs carry only the minimum fields needed to start the receiving workflow.

## Local checks

```sh
bun run verify
```
