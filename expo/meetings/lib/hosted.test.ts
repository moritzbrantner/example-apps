import { describe, expect, test } from 'bun:test';
import { claimGuestParticipant } from './commands';
import {
  InvalidGuestSessionError,
  InvalidInviteError,
  MeetingHostingService,
  VersionConflictError,
  type SecretTokenAuthority,
} from './hosted';
import { InMemoryGuestAccessStore, InMemoryHostedMeetingStore } from './hosted-memory';
import type { Meeting } from './model';

const meeting: Meeting = {
  id: 'meeting-hosted',
  title: 'Hosted planning night',
  scope: { kind: 'standalone' },
  destination: { id: 'destination', label: 'Hall', latitude: 48.78, longitude: 9.18 },
  participants: [
    { id: 'organizer', displayName: 'Organizer', identity: { kind: 'account', accountId: 'account-owner' } },
    { id: 'guest', displayName: 'Guest', identity: { kind: 'guest', guestId: 'guest-1' } },
  ],
  dateOptions: [
    { id: 'date', start: '2026-09-20T18:00:00+02:00', end: '2026-09-20T20:00:00+02:00' },
  ],
  availability: [{ participantId: 'guest', dateOptionId: 'date', status: 'available' }],
  confirmedDateOptionId: null,
  bringItems: [
    { id: 'projector', label: 'Projector', quantity: '1', assigneeParticipantId: 'guest', status: 'needed' },
  ],
  rideOffers: [],
  rideRequests: [],
};

class SequenceTokenAuthority implements SecretTokenAuthority {
  constructor(private readonly values: string[]) {}

  async createToken() {
    const token = this.values.shift();
    if (!token) throw new Error('No deterministic token left');
    return { token, digest: await this.digest(token) };
  }

  async digest(token: string) {
    return `digest:${token}`;
  }
}

function setup(tokens = ['invite-secret', 'session-secret', 'unused-session']) {
  const meetings = new InMemoryHostedMeetingStore();
  const access = new InMemoryGuestAccessStore();
  const service = new MeetingHostingService(
    meetings,
    access,
    new SequenceTokenAuthority(tokens),
    { guestSessionTtlMs: 60 * 60 * 1000 },
  );
  return { meetings, access, service };
}

describe('hosted meeting persistence', () => {
  test('uses optimistic versions and rejects stale writes', async () => {
    const { service } = setup();
    const created = await service.createMeeting(meeting);
    expect(created.version).toBe(1);

    const renamed = { ...created.meeting, title: 'Updated title' };
    const saved = await service.saveMeeting(renamed, created.version);
    expect(saved.version).toBe(2);
    await expect(service.saveMeeting(renamed, created.version)).rejects.toBeInstanceOf(
      VersionConflictError,
    );
  });
});

describe('guest invite access', () => {
  test('persists only token digests and redeems an invite once', async () => {
    const { access, service } = setup();
    await service.createMeeting(meeting);
    const invite = await service.issueGuestInvite(
      meeting.id,
      'guest',
      '2026-09-16T12:00:00Z',
      '2026-09-15T12:00:00Z',
    );

    expect(invite.token).toBe('invite-secret');
    expect(access.hasInviteDigest('digest:invite-secret')).toBe(true);
    expect(access.hasInviteDigest('invite-secret')).toBe(false);

    const guest = await service.redeemGuestInvite(invite.token, '2026-09-15T13:00:00Z');
    expect(guest.participantId).toBe('guest');
    expect(guest.guestSessionToken).toBe('session-secret');
    expect(access.hasGuestSessionDigest('digest:session-secret')).toBe(true);
    expect(access.hasGuestSessionDigest('session-secret')).toBe(false);
    await expect(service.redeemGuestInvite(invite.token, '2026-09-15T13:01:00Z')).rejects.toBeInstanceOf(
      InvalidInviteError,
    );
  });

  test('rejects expired invite tokens', async () => {
    const { service } = setup();
    await service.createMeeting(meeting);
    const invite = await service.issueGuestInvite(
      meeting.id,
      'guest',
      '2026-09-15T12:30:00Z',
      '2026-09-15T12:00:00Z',
    );
    await expect(service.redeemGuestInvite(invite.token, '2026-09-15T12:31:00Z')).rejects.toBeInstanceOf(
      InvalidInviteError,
    );
  });

  test('guest account claiming preserves participant-owned meeting state', async () => {
    const { service } = setup();
    await service.createMeeting(meeting);
    const invite = await service.issueGuestInvite(
      meeting.id,
      'guest',
      '2026-09-16T12:00:00Z',
      '2026-09-15T12:00:00Z',
    );
    const guest = await service.redeemGuestInvite(invite.token, '2026-09-15T12:05:00Z');
    const beforeClaim = await service.readMeetingForGuest(
      guest.guestSessionToken,
      '2026-09-15T12:06:00Z',
    );
    expect(beforeClaim.participantId).toBe('guest');

    const claimed = await service.claimGuestAccount(
      guest.guestSessionToken,
      'account-guest',
      '2026-09-15T12:07:00Z',
    );
    expect(claimed.meeting.participants.find((participant) => participant.id === 'guest')?.identity).toEqual({
      kind: 'account',
      accountId: 'account-guest',
    });
    expect(claimed.meeting.availability).toContainEqual({
      participantId: 'guest',
      dateOptionId: 'date',
      status: 'available',
    });
    expect(claimed.meeting.bringItems[0].assigneeParticipantId).toBe('guest');

    const retry = await service.claimGuestAccount(
      guest.guestSessionToken,
      'account-guest',
      '2026-09-15T12:08:00Z',
    );
    expect(retry.meeting.participants.find((participant) => participant.id === 'guest')?.id).toBe('guest');
    await expect(
      service.claimGuestAccount(guest.guestSessionToken, 'other-account', '2026-09-15T12:09:00Z'),
    ).rejects.toBeInstanceOf(InvalidGuestSessionError);
    await expect(
      service.readMeetingForGuest(guest.guestSessionToken, '2026-09-15T12:10:00Z'),
    ).rejects.toBeInstanceOf(InvalidGuestSessionError);
  });

  test('the domain refuses to rebind an already claimed participant', () => {
    const claimed = claimGuestParticipant(meeting, 'guest', 'account-guest');
    expect(() => claimGuestParticipant(claimed, 'guest', 'other-account')).toThrow();
  });
});
