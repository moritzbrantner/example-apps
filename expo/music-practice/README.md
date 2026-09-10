# Music Practice

A local-first practice notebook for musicians.

## MVP contract

- Record instrument, piece/exercise, focus, notes, and practice duration.
- Run a simple foreground practice timer based on elapsed wall-clock time rather than tick counting.
- Record an optional audio take with the microphone using Expo Audio.
- Store native recordings in the app document directory so they survive normal cache cleanup; browser recordings are treated as temporary.
- Play previous takes from the session list.
- Persist session metadata locally with AsyncStorage and fail closed after storage read errors.
- No account, streaks, scores, social feed, ads, analytics, or cloud dependency.

## Boundary

This app owns practice sessions and practice recordings. It does not yet own instrument inventory, sheet music, tuning analysis, or repertoire metadata; those requirements should emerge from use rather than be designed in advance.

## Local checks

```sh
bun run verify
```
