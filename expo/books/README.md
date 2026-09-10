# Books

A local-first Expo app for keeping a personal reading library without storing the contents of the books themselves.

## MVP contract

- Scan an ISBN-13/EAN-13 barcode with `expo-camera`, or enter ISBN-10/13 manually.
- Validate and canonicalize ISBNs before they enter the library.
- Enrich valid ISBNs with title, author, cover, publication year, and publisher metadata from Open Library.
- Keep the library and personal writing on-device with AsyncStorage.
- Record reading status and completion date.
- Keep quick notes, a considered review, key ideas, and why the book mattered as distinct user-authored fields.
- Search locally across book metadata and personal annotations.
- Continue to work when metadata lookup is unavailable; online data is enrichment, not ownership of the library.
- Store book metadata and user-authored annotations only. Do not download or retain ebook/full-text content.

## Example-app boundary

This app is a standalone consumer of the Expo foundation. Store-release scaffolding and fleet release machinery remain owned by `expo-template`; this repository owns the concrete app behavior and its tests.

## Local checks

```sh
bun run verify
```
