# Habits

A local-first habit tracker focused on simple check-ins rather than engagement mechanics.

## MVP contract

- Add a named habit with a weekly target of 3, 5, or 7 days.
- Mark or unmark the current day.
- See the previous seven days and progress against the weekly target.
- Remove habits and keep the full record on-device with AsyncStorage.
- No streak scoring, social feed, account, reminders, or cloud sync in this slice.

## Example-app boundary

This repository owns the concrete habit-tracking behavior and tests. Store-release scaffolding and fleet release machinery remain owned by `expo-template`.

The legacy AsyncStorage key is intentionally preserved so moving repository ownership does not strand an existing local record.

## Local checks

```sh
bun run verify
```
