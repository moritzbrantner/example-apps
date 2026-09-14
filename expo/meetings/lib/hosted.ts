import { claimGuestParticipant } from './commands';
import type { Meeting } from './model';

export interface VersionedMeeting {
  meeting: Meeting;
  version: number;
}

export interface IssuedGuestInvite {
  inviteId: string;
  meetingId: string;
  participantId: string;
  token: string;
  expiresAt: string;
}

export interface GuestAccess {
  meetingId: string;
  participantId: string;
  guestSessionToken: string;
  expiresAt: string;
}

export interface StoredInvite {
  id: string;
  meetingId: string;
  participantId: string;
  tokenDigest: string;
  expiresAt: string;
  redeemedAt: string | null;
}

export interface GuestSessionDraft {
  id: string;
  tokenDigest: string;
  expiresAt: string;
}

export interface StoredGuestSession extends GuestSessionDraft {
  meetingId: string;
  participantId: string;
  accountId: string | null;
}

export interface HostedMeetingStore {
  read(meetingId: string): Promise<VersionedMeeting | null>;
  create(meeting: Meeting): Promise<VersionedMeeting>;
  replace(meeting: Meeting, expectedVersion: number): Promise<VersionedMeeting>;
}

export interface GuestAccessStore {
  createInvite(invite: StoredInvite): Promise<void>;
  consumeInvite(
    tokenDigest: string,
    now: string,
    session: GuestSessionDraft,
  ): Promise<StoredGuestSession | null>;
  readGuestSession(tokenDigest: string, now: string): Promise<StoredGuestSession | null>;
  bindGuestSessionToAccount(tokenDigest: string, accountId: string, now: string): Promise<void>;
}

export interface SecretTokenAuthority {
  createToken(): Promise<{ token: string; digest: string }>;
  digest(token: string): Promise<string>;
}

export class VersionConflictError extends Error {
  constructor(message = 'Hosted meeting version conflict') {
    super(message);
    this.name = 'VersionConflictError';
  }
}

export class MeetingNotFoundError extends Error {
  constructor(meetingId: string) {
    super(`Meeting not found: ${meetingId}`);
    this.name = 'MeetingNotFoundError';
  }
}

export class InvalidInviteError extends Error {
  constructor(message = 'Invite is invalid, expired, or already redeemed') {
    super(message);
    this.name = 'InvalidInviteError';
  }
}

export class InvalidGuestSessionError extends Error {
  constructor(message = 'Guest session is invalid or expired') {
    super(message);
    this.name = 'InvalidGuestSessionError';
  }
}

function parseTimestamp(value: string, label: string) {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error(`${label} must be an ISO timestamp`);
  return milliseconds;
}

function recordId(prefix: string, digest: string) {
  return `${prefix}_${digest.slice(0, 24)}`;
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class WebCryptoTokenAuthority implements SecretTokenAuthority {
  async createToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = hex(bytes);
    return { token, digest: await this.digest(token) };
  }

  async digest(token: string) {
    const bytes = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return hex(new Uint8Array(digest));
  }
}

export interface MeetingHostingOptions {
  guestSessionTtlMs?: number;
}

const DEFAULT_GUEST_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class MeetingHostingService {
  private readonly guestSessionTtlMs: number;

  constructor(
    private readonly meetings: HostedMeetingStore,
    private readonly access: GuestAccessStore,
    private readonly tokens: SecretTokenAuthority,
    options: MeetingHostingOptions = {},
  ) {
    this.guestSessionTtlMs = options.guestSessionTtlMs ?? DEFAULT_GUEST_SESSION_TTL_MS;
    if (!Number.isFinite(this.guestSessionTtlMs) || this.guestSessionTtlMs <= 0) {
      throw new Error('guestSessionTtlMs must be positive');
    }
  }

  createMeeting(meeting: Meeting) {
    return this.meetings.create(meeting);
  }

  saveMeeting(meeting: Meeting, expectedVersion: number) {
    return this.meetings.replace(meeting, expectedVersion);
  }

  async issueGuestInvite(
    meetingId: string,
    participantId: string,
    expiresAt: string,
    now: string,
  ): Promise<IssuedGuestInvite> {
    const nowMs = parseTimestamp(now, 'now');
    const expiresAtMs = parseTimestamp(expiresAt, 'expiresAt');
    if (expiresAtMs <= nowMs) throw new InvalidInviteError('Invite expiry must be in the future');

    const versioned = await this.meetings.read(meetingId);
    if (!versioned) throw new MeetingNotFoundError(meetingId);
    const participant = versioned.meeting.participants.find((candidate) => candidate.id === participantId);
    if (!participant) throw new InvalidInviteError(`Unknown participant: ${participantId}`);
    if (participant.identity.kind !== 'guest') {
      throw new InvalidInviteError('Account participants do not need guest invite tokens');
    }

    const secret = await this.tokens.createToken();
    const invite: StoredInvite = {
      id: recordId('invite', secret.digest),
      meetingId,
      participantId,
      tokenDigest: secret.digest,
      expiresAt,
      redeemedAt: null,
    };
    await this.access.createInvite(invite);
    return {
      inviteId: invite.id,
      meetingId,
      participantId,
      token: secret.token,
      expiresAt,
    };
  }

  async redeemGuestInvite(inviteToken: string, now: string): Promise<GuestAccess> {
    const nowMs = parseTimestamp(now, 'now');
    const inviteDigest = await this.tokens.digest(inviteToken);
    const sessionSecret = await this.tokens.createToken();
    const expiresAt = new Date(nowMs + this.guestSessionTtlMs).toISOString();
    const session = await this.access.consumeInvite(inviteDigest, now, {
      id: recordId('guest', sessionSecret.digest),
      tokenDigest: sessionSecret.digest,
      expiresAt,
    });
    if (!session) throw new InvalidInviteError();

    return {
      meetingId: session.meetingId,
      participantId: session.participantId,
      guestSessionToken: sessionSecret.token,
      expiresAt: session.expiresAt,
    };
  }

  async readMeetingForGuest(guestSessionToken: string, now: string) {
    parseTimestamp(now, 'now');
    const sessionDigest = await this.tokens.digest(guestSessionToken);
    const session = await this.access.readGuestSession(sessionDigest, now);
    if (!session || session.accountId !== null) throw new InvalidGuestSessionError();
    const versioned = await this.meetings.read(session.meetingId);
    if (!versioned) throw new MeetingNotFoundError(session.meetingId);
    const participant = versioned.meeting.participants.find(
      (candidate) => candidate.id === session.participantId,
    );
    if (!participant || participant.identity.kind !== 'guest') {
      throw new InvalidGuestSessionError('Guest participant is no longer guest-accessible');
    }
    return { ...versioned, participantId: session.participantId };
  }

  async claimGuestAccount(
    guestSessionToken: string,
    accountId: string,
    now: string,
  ): Promise<VersionedMeeting> {
    if (!accountId.trim()) throw new Error('accountId is required');
    parseTimestamp(now, 'now');
    const sessionDigest = await this.tokens.digest(guestSessionToken);
    const session = await this.access.readGuestSession(sessionDigest, now);
    if (!session) throw new InvalidGuestSessionError();
    if (session.accountId !== null && session.accountId !== accountId) {
      throw new InvalidGuestSessionError('Guest session is already bound to another account');
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const versioned = await this.meetings.read(session.meetingId);
      if (!versioned) throw new MeetingNotFoundError(session.meetingId);
      const participant = versioned.meeting.participants.find(
        (candidate) => candidate.id === session.participantId,
      );
      if (!participant) throw new InvalidGuestSessionError('Guest participant no longer exists');

      if (participant.identity.kind === 'account') {
        if (participant.identity.accountId !== accountId) {
          throw new InvalidGuestSessionError('Participant is already claimed by another account');
        }
        await this.access.bindGuestSessionToAccount(sessionDigest, accountId, now);
        return versioned;
      }

      const updated = claimGuestParticipant(versioned.meeting, session.participantId, accountId);
      try {
        const saved = await this.meetings.replace(updated, versioned.version);
        await this.access.bindGuestSessionToAccount(sessionDigest, accountId, now);
        return saved;
      } catch (error) {
        if (!(error instanceof VersionConflictError) || attempt === 2) throw error;
      }
    }

    throw new VersionConflictError();
  }
}
