import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MeetingHostingService, type SecretTokenAuthority } from './hosted';
import { BunSqliteHostedStore } from './hosted-sqlite';
import type { Meeting } from './model';

const meeting: Meeting = {
  id: 'durable-meeting',
  title: 'Durable planning night',
  scope: { kind: 'standalone' },
  destination: { id: 'destination', label: 'Hall', latitude: 48.78, longitude: 9.18 },
  participants: [
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

test('Bun SQLite adapter persists meetings, invites, sessions, and account claims across reopen', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'meeting-planner-'));
  const filename = join(directory, 'meetings.sqlite');
  let first: BunSqliteHostedStore | null = null;
  let second: BunSqliteHostedStore | null = null;
  let third: BunSqliteHostedStore | null = null;

  try {
    first = new BunSqliteHostedStore(filename);
    const firstService = new MeetingHostingService(
      first,
      first,
      new SequenceTokenAuthority(['invite-secret']),
      { guestSessionTtlMs: 60 * 60 * 1000 },
    );
    await firstService.createMeeting(meeting);
    const invite = await firstService.issueGuestInvite(
      meeting.id,
      'guest',
      '2026-09-16T12:00:00Z',
      '2026-09-15T12:00:00Z',
    );
    first.close();
    first = null;

    second = new BunSqliteHostedStore(filename);
    const secondService = new MeetingHostingService(
      second,
      second,
      new SequenceTokenAuthority(['session-secret']),
      { guestSessionTtlMs: 60 * 60 * 1000 },
    );
    const restored = await second.read(meeting.id);
    expect(restored?.version).toBe(1);
    expect(restored?.meeting.availability).toEqual(meeting.availability);

    const guest = await secondService.redeemGuestInvite(invite.token, '2026-09-15T12:05:00Z');
    const claimed = await secondService.claimGuestAccount(
      guest.guestSessionToken,
      'account-guest',
      '2026-09-15T12:06:00Z',
    );
    expect(claimed.version).toBe(2);
    second.close();
    second = null;

    third = new BunSqliteHostedStore(filename);
    const persisted = await third.read(meeting.id);
    expect(persisted?.version).toBe(2);
    expect(persisted?.meeting.participants[0]).toEqual({
      id: 'guest',
      displayName: 'Guest',
      identity: { kind: 'account', accountId: 'account-guest' },
    });
    expect(persisted?.meeting.bringItems[0].assigneeParticipantId).toBe('guest');
  } finally {
    first?.close();
    second?.close();
    third?.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
