# Contraction Timer

A local-first timing log for contractions. It is a recorder, not a medical decision system.

## MVP contract

- Start a contraction when it begins and stop it when it ends.
- Derive duration and start-to-start interval from timestamps.
- Keep the active start timestamp across reloads so a running timer is not lost.
- Show count, average duration, and average interval for contractions started in the last hour.
- Delete individual records or clear the session.
- Persist everything on-device with AsyncStorage.
- Do not infer labor stage, apply a 5-1-1 rule, or tell the user when to travel for care.

The UI explicitly tells users to follow instructions from their own maternity team and seek care when concerned.

## Local checks

```sh
bun install
bun run verify
```
