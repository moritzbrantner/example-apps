# Household Documents

A local-first catalog for receipts, warranties, manuals, contracts, and other household files.

## MVP contract

- Import a file with the system document picker.
- On native platforms, copy imported files into the app's persistent document directory before recording them.
- Keep title, category, notes, original file name, MIME type, size, and source reference as local metadata.
- Accept `documents://add` handoffs from other everyday apps without taking ownership of their domain objects.
- Export a managed native file through the system sharing sheet.
- Delete the managed file together with its local record when requested.
- Persist metadata with AsyncStorage and never overwrite stored metadata after a failed hydration read.
- No account, analytics, ads, remote document service, or cloud requirement.

## Web boundary

The web preview can exercise the catalog and picker, but browser-selected local-file URLs are temporary and cannot provide the same durable managed-file guarantee as native app document storage. The UI states this limitation rather than pretending web parity.

## Local checks

```sh
bun run verify
```
