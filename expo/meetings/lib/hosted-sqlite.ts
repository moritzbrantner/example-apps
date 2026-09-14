import { Database } from 'bun:sqlite';
import {
  InvalidGuestSessionError,
  VersionConflictError,
  type GuestAccessStore,
  type GuestSessionDraft,
  type HostedMeetingStore,
  type StoredGuestSession,
  type StoredInvite,
  type VersionedMeeting,
} from './hosted';
import type { Meeting } from './model';

type MeetingRow = {
  version: number;
  payload: string;
};

type InviteRow = {
  meeting_id: string;
  participant_id: string;
  expires_at_ms: number;
  redeemed_at: string | null;
};

type SessionRow = {
  id: string;
  meeting_id: string;
  participant_id: string;
  token_digest: string;
  expires_at_ms: number;
  account_id: string | null;
};

function timestamp(value: string, label: string) {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error(`${label} must be an ISO timestamp`);
  return milliseconds;
}

function parseMeeting(payload: string): Meeting {
  const parsed = JSON.parse(payload) as Partial<Meeting>;
  if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') {
    throw new Error('Stored meeting payload is malformed');
  }
  return parsed as Meeting;
}

function toGuestSession(row: SessionRow): StoredGuestSession {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    participantId: row.participant_id,
    tokenDigest: row.token_digest,
    expiresAt: new Date(row.expires_at_ms).toISOString(),
    accountId: row.account_id,
  };
}

export class BunSqliteHostedStore implements HostedMeetingStore, GuestAccessStore {
  private readonly db: Database;

  constructor(filename = 'meetings.sqlite') {
    this.db = new Database(filename, { create: true, strict: true });
    this.migrate();
  }

  close() {
    this.db.close();
  }

  private migrate() {
    this.db.exec('PRAGMA foreign_keys = ON;');
    const versionRow = this.db.query('PRAGMA user_version;').get() as
      | { user_version: number }
      | undefined;
    const version = versionRow?.user_version ?? 0;
    if (version > 1) throw new Error(`Unsupported meetings database schema version: ${version}`);
    if (version === 1) return;

    this.db.exec(`
      CREATE TABLE hosted_meetings (
        id TEXT PRIMARY KEY,
        version INTEGER NOT NULL CHECK (version > 0),
        payload TEXT NOT NULL
      );

      CREATE TABLE hosted_invites (
        id TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL REFERENCES hosted_meetings(id) ON DELETE CASCADE,
        participant_id TEXT NOT NULL,
        token_digest TEXT NOT NULL UNIQUE,
        expires_at_ms INTEGER NOT NULL,
        redeemed_at TEXT
      );

      CREATE INDEX hosted_invites_meeting_idx ON hosted_invites(meeting_id);

      CREATE TABLE hosted_guest_sessions (
        id TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL REFERENCES hosted_meetings(id) ON DELETE CASCADE,
        participant_id TEXT NOT NULL,
        token_digest TEXT NOT NULL UNIQUE,
        expires_at_ms INTEGER NOT NULL,
        account_id TEXT
      );

      CREATE INDEX hosted_guest_sessions_meeting_idx ON hosted_guest_sessions(meeting_id);
      PRAGMA user_version = 1;
    `);
  }

  async read(meetingId: string): Promise<VersionedMeeting | null> {
    const row = this.db
      .query('SELECT version, payload FROM hosted_meetings WHERE id = ?1')
      .get(meetingId) as MeetingRow | undefined;
    if (!row) return null;
    return { meeting: parseMeeting(row.payload), version: row.version };
  }

  async create(meeting: Meeting): Promise<VersionedMeeting> {
    const result = this.db
      .query('INSERT OR IGNORE INTO hosted_meetings (id, version, payload) VALUES (?1, 1, ?2)')
      .run(meeting.id, JSON.stringify(meeting));
    if (result.changes !== 1) throw new VersionConflictError(`Meeting already exists: ${meeting.id}`);
    return { meeting: structuredClone(meeting), version: 1 };
  }

  async replace(meeting: Meeting, expectedVersion: number): Promise<VersionedMeeting> {
    const result = this.db
      .query(
        'UPDATE hosted_meetings SET payload = ?1, version = version + 1 WHERE id = ?2 AND version = ?3',
      )
      .run(JSON.stringify(meeting), meeting.id, expectedVersion);
    if (result.changes !== 1) throw new VersionConflictError();
    return { meeting: structuredClone(meeting), version: expectedVersion + 1 };
  }

  async createInvite(invite: StoredInvite) {
    this.db
      .query(
        `INSERT INTO hosted_invites
          (id, meeting_id, participant_id, token_digest, expires_at_ms, redeemed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .run(
        invite.id,
        invite.meetingId,
        invite.participantId,
        invite.tokenDigest,
        timestamp(invite.expiresAt, 'invite.expiresAt'),
        invite.redeemedAt,
      );
  }

  async consumeInvite(tokenDigest: string, now: string, draft: GuestSessionDraft) {
    const nowMs = timestamp(now, 'now');
    const sessionExpiresAtMs = timestamp(draft.expiresAt, 'session.expiresAt');
    const consume = this.db.transaction(() => {
      const invite = this.db
        .query(
          `SELECT meeting_id, participant_id, expires_at_ms, redeemed_at
           FROM hosted_invites WHERE token_digest = ?1`,
        )
        .get(tokenDigest) as InviteRow | undefined;
      if (!invite || invite.redeemed_at !== null || invite.expires_at_ms <= nowMs) return null;

      const claimed = this.db
        .query(
          `UPDATE hosted_invites SET redeemed_at = ?1
           WHERE token_digest = ?2 AND redeemed_at IS NULL AND expires_at_ms > ?3`,
        )
        .run(now, tokenDigest, nowMs);
      if (claimed.changes !== 1) return null;

      this.db
        .query(
          `INSERT INTO hosted_guest_sessions
            (id, meeting_id, participant_id, token_digest, expires_at_ms, account_id)
           VALUES (?1, ?2, ?3, ?4, ?5, NULL)`,
        )
        .run(
          draft.id,
          invite.meeting_id,
          invite.participant_id,
          draft.tokenDigest,
          sessionExpiresAtMs,
        );

      return {
        id: draft.id,
        meetingId: invite.meeting_id,
        participantId: invite.participant_id,
        tokenDigest: draft.tokenDigest,
        expiresAt: new Date(sessionExpiresAtMs).toISOString(),
        accountId: null,
      } satisfies StoredGuestSession;
    });
    return consume();
  }

  async readGuestSession(tokenDigest: string, now: string) {
    const nowMs = timestamp(now, 'now');
    const row = this.db
      .query(
        `SELECT id, meeting_id, participant_id, token_digest, expires_at_ms, account_id
         FROM hosted_guest_sessions WHERE token_digest = ?1 AND expires_at_ms > ?2`,
      )
      .get(tokenDigest, nowMs) as SessionRow | undefined;
    return row ? toGuestSession(row) : null;
  }

  async bindGuestSessionToAccount(tokenDigest: string, accountId: string, now: string) {
    const nowMs = timestamp(now, 'now');
    const bind = this.db.transaction(() => {
      const row = this.db
        .query(
          `SELECT id, meeting_id, participant_id, token_digest, expires_at_ms, account_id
           FROM hosted_guest_sessions WHERE token_digest = ?1 AND expires_at_ms > ?2`,
        )
        .get(tokenDigest, nowMs) as SessionRow | undefined;
      if (!row) throw new InvalidGuestSessionError();
      if (row.account_id !== null && row.account_id !== accountId) {
        throw new InvalidGuestSessionError('Guest session is already bound to another account');
      }
      this.db
        .query('UPDATE hosted_guest_sessions SET account_id = ?1 WHERE token_digest = ?2')
        .run(accountId, tokenDigest);
    });
    bind();
  }
}
