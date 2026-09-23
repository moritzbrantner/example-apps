# Gregorian Chant

A local-first Gregorian chant library and practice application.

## First slice

- searchable chant catalog with liturgical metadata
- GABC as the canonical notation representation
- source/provenance kept with each notation artifact
- phrase identities that can later receive recording timings without changing chant identity
- explicit playback and analysis adapter boundaries
- one checked-in Vatican-edition Kyrie XI GABC fixture plus additional catalog entries

This slice intentionally refuses to invent timing evidence. Practice loops become valid only after an actual recording has authoritative phrase start/end times.

## Foundation boundaries

- **This app/domain** owns chant identity, variants, liturgical metadata, Latin text, GABC references, source provenance, phrase identity, practice intent, and user-facing library/practice workflows.
- **media-player** should supply reusable transport behavior: load, play/pause, seek, rate, queue/session behavior, and local-media handling. The app depends on an adapter contract rather than copying its implementation.
- **audio-analysis** remains authoritative for waveform/signal/pitch/dynamics analysis and future sung-attempt comparison primitives.
- **native-whisperx** is an optional ingestion tool for transcription/alignment experiments. It is not part of ordinary playback and its output must be corrected/validated before becoming chant timing data.
- **notation rendering** consumes canonical GABC. Rendered SVG/PDF/image output is derived and must never become the authoritative chant representation.

## Notation rendering

The reader renders canonical GABC through an app-owned `GabcNotationRenderer` boundary. The current adapter uses `@vagdur/exsurge` inside an Expo DOM component: it runs directly in the browser on web and inside Expo's local DOM WebView on native. The SVG is generated on demand and is never persisted as chant authority.

Rendering failure is non-destructive. The canonical GABC stays visible in the reader, so a derived-view problem cannot replace or rewrite source notation.

## Next vertical slice

1. Extract/consume a reusable media-player transport package rather than duplicating player state here.
2. Attach a local recording to a chant and persist recording provenance.
3. Capture phrase timings against that recording and enable slow playback + phrase loops.
4. Only then add pitch-following/sing-along analysis through audio-analysis.

A later native Swift/Kotlin client can consume the same catalog/domain contracts. The Expo app is deliberately a dogfooding/product surface, not the authority for chant or signal-processing semantics.
