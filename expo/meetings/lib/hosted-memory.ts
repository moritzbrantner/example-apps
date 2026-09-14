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

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryHostedMeetingStore implements HostedMeetingStore {
  private readonly records = new Map<string, VersionedMeeting>();

  async read(meetingId: string) {
    const value = this.records.get(meetingId);
    return value ? clone(value) : null;
  }

  async create(meeting: Meeting) {
    if (this.records.has(meeting.id)) throw new VersionConflictError(`Meeting already exists: ${meeting.id}`);
    const value = { meeting: clone(meeting), version: 1 };
    this.records.set(meeting.id, value);
    return clone(value);
  }

  async replace(meeting: Meeting, expectedVersion: number) {
    const current = this.records.get(meeting.id);
    if (!current || current.version !== expectedVersion) throw new VersionConflictError();
    const value = { meeting: clone(meeting), version: expectedVersion + 1 };
    this.records.set(meeting.id, value);
    return clone(value);
  }
}

export class InMemoryGuestAccessStore implements GuestAccessStore {
  private readonly invitesByDigest = new Map<string, StoredInvite>();
  private readonly sessionsByDigest = new Map<string, StoredGuestSession>();

  async createInvite(invite: StoredInvite) {
    if (this.invitesByDigest.has(invite.tokenDigest)) {
      throw new Error('Invite token digest already exists');
    }
    this.invitesByDigest.set(invite.tokenDigest, clone(invite));
  }

  async consumeInvite(tokenDigest: string, now: string, draft: GuestSessionDraft) {
    const invite = this.invitesByDigest.get(tokenDigest);
    if (
      !invite ||
      invite.redeemedAt !== null ||
      Date.parse(invite.expiresAt) <= Date.parse(now) ||
      this.sessionsByDigest.has(draft.tokenDigest)
    ) {
      return null;
    }

    const session: StoredGuestSession = {
      ...clone(draft),
      meetingId: invite.meetingId,
      participantId: invite.participantId,
      accountId: null,
    };
    this.invitesByDigest.set(tokenDigest, { ...invite, redeemedAt: now });
    this.sessionsByDigest.set(session.tokenDigest, session);
    return clone(session);
  }

  async readGuestSession(tokenDigest: string, now: string) {
    const session = this.sessionsByDigest.get(tokenDigest);
    if (!session || Date.parse(session.expiresAt) <= Date.parse(now)) return null;
    return clone(session);
  }

  async bindGuestSessionToAccount(tokenDigest: string, accountId: string, now: string) {
    const session = await this.readGuestSession(tokenDigest, now);
    if (!session) throw new InvalidGuestSessionError();
    if (session.accountId !== null && session.accountId !== accountId) {
      throw new InvalidGuestSessionError('Guest session is already bound to another account');
    }
    this.sessionsByDigest.set(tokenDigest, { ...session, accountId });
  }

  hasInviteDigest(digest: string) {
    return this.invitesByDigest.has(digest);
  }

  hasGuestSessionDigest(digest: string) {
    return this.sessionsByDigest.has(digest);
  }
}
