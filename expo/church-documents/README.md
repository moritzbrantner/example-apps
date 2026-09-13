# Church Documents

A local-first Expo example for discovering and tracking authoritative Catholic Church documents.

## First slice

- searchable catalog with deterministic filtering
- council and encyclical categories
- document metadata, subjects, and original summaries
- local bookmarks and reading status
- explicit handoff to the canonical Vatican source

The bundled catalog stores metadata and app-authored summaries only. It does not silently vendor the authoritative document text. A later ingestion slice can add in-app reading once source provenance, supported languages, update policy, and text licensing/copyright handling are explicit and testable.

## Ownership boundary

The app owns catalog presentation, local reading state, search, and source handoff. Vatican-hosted text remains authoritative. The app must not rewrite, summarize into replacement doctrine, or present generated prose as if it were the source document.

## Verify

```sh
bun install
bun run verify
```
