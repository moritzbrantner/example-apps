# Church Documents

A local-first Expo example for discovering, reading, and tracking authoritative Catholic Church documents while keeping source provenance explicit.

## Catalog slice

- searchable catalog with deterministic filtering
- council and encyclical categories
- document metadata, subjects, and app-authored summaries
- local document bookmarks and reading status
- explicit handoff to the canonical Vatican source

## Reader slice

- reviewed reader-source registry separated from catalog metadata
- explicit download and local cache instead of silent remote replacement
- source revision recorded alongside cached content when the provider exposes it
- section navigation and full-text paragraph search
- paragraph bookmarks and a local resume location
- mobile-sized controls and readable long-form typography

The first in-app reader source is the English `Rerum Novarum` transcription hosted by Wikisource from a historical public-domain edition. The Vatican-hosted document remains the canonical reference. Other documents and languages stay source-only until their text source, provenance, and copyright/licensing status are explicitly reviewed.

## Ownership boundary

The app owns catalog presentation, local reading state, source download/cache behavior, search, and source handoff. It must not rewrite source text, silently substitute generated prose, or present an unreviewed translation as authoritative. Reader content can be refreshed only by an explicit user action.

## Verify

```sh
bun install
bun run verify
```
