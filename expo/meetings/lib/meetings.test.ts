import { describe, expect, test } from 'bun:test';
import { calculateCarpoolPlan } from './carpool';
import { claimGuestParticipant, recordAvailability } from './commands';
import type { Meeting } from './model';
import { getBringReminders, rankDateOptions } from './queries';

const meeting: Meeting = {
  id: 'meeting-1',
  title: 'Planning night',
  scope: { kind: 'group', groupId: 'group-1' },
  destination: { id: 'destination', label: 'Community hall', latitude: 48.78, longitude: 9.18 },
  participants: [
    { id: 'alice', displayName: 'Alice', identity: { kind: 'account', accountId: 'account-a' } },
    { id: 'bob', displayName: 'Bob', identity: { kind: 'guest', guestId: 'guest-b' } },
  ],
  dateOptions: [
    { id: 'date-a', start: '2026-09-20T18:00:00+02:00', end: '2026-09-20T20:00:00+02:00' },
    { id: 'date-b', start: '2026-09-21T18:00:00+02:00', end: '2026-09-21T20:00:00+02:00' },
  ],
  availability: [
    { participantId: 'alice', dateOptionId: 'date-a', status: 'available' },
    { participantId: 'alice', dateOptionId: 'date-b', status: 'if-needed' },
    { participantId: 'bob', dateOptionId: 'date-a', status: 'available' },
  ],
  confirmedDateOptionId: null,
  bringItems: [
    { id: 'projector', label: 'Projector', quantity: '1', assigneeParticipantId: 'bob', status: 'needed' },
    { id: 'cables', label: 'HDMI cable', quantity: '2', assigneeParticipantId: 'bob', status: 'brought' },
  ],
  rideOffers: [],
  rideRequests: [],
};

describe('meeting domain', () => {
  test('ranks date options while keeping if-needed distinct from available', () => {
    const ranking = rankDateOptions(meeting);
    expect(ranking[0].option.id).toBe('date-a');
    expect(ranking[0].available).toBe(2);
    expect(ranking[1].ifNeeded).toBe(1);
    expect(ranking[1].unanswered).toBe(1);
  });

  test('guest responses remain attached when the guest claims an account', () => {
    const updated = claimGuestParticipant(meeting, 'bob', 'account-b');
    const bob = updated.participants.find((participant) => participant.id === 'bob');
    expect(bob?.identity).toEqual({ kind: 'account', accountId: 'account-b' });
    expect(updated.availability.filter((response) => response.participantId === 'bob')).toHaveLength(1);
    expect(updated.bringItems.find((item) => item.id === 'projector')?.assigneeParticipantId).toBe('bob');
  });

  test('availability commands replace the participant response idempotently', () => {
    const once = recordAvailability(meeting, 'bob', 'date-b', 'if-needed');
    const twice = recordAvailability(once, 'bob', 'date-b', 'if-needed');
    expect(twice.availability.filter((response) => response.participantId === 'bob' && response.dateOptionId === 'date-b')).toHaveLength(1);
  });

  test('bring reminders omit already-brought responsibilities', () => {
    expect(getBringReminders(meeting, 'bob')).toEqual([
      { itemId: 'projector', label: 'Projector', quantity: '1', status: 'needed' },
    ]);
  });
});

describe('carpool optimizer', () => {
  test('maximizes matched passengers before minimizing route detour', () => {
    const offers = [
      { id: 'offer-a', driverParticipantId: 'driver-a', seats: 1, origin: { id: 'a', label: 'A', latitude: 0, longitude: 0 } },
      { id: 'offer-b', driverParticipantId: 'driver-b', seats: 1, origin: { id: 'b', label: 'B', latitude: 0, longitude: 0 } },
    ];
    const requests = [
      { id: 'request-1', participantId: 'rider-1', pickup: { id: 'r1', label: 'R1', latitude: 0, longitude: 0 } },
      { id: 'request-2', participantId: 'rider-2', pickup: { id: 'r2', label: 'R2', latitude: 0, longitude: 0 } },
    ];
    const plan = calculateCarpoolPlan(offers, requests, [
      { offerId: 'offer-a', requestId: 'request-1', detourMinutes: 1, distanceKm: 1 },
      { offerId: 'offer-b', requestId: 'request-1', detourMinutes: 2, distanceKm: 2 },
      { offerId: 'offer-a', requestId: 'request-2', detourMinutes: 1, distanceKm: 1 },
    ]);
    expect(plan.matches).toHaveLength(2);
    expect(plan.unmatchedRequestIds).toEqual([]);
    expect(plan.matches.find((match) => match.requestId === 'request-2')?.offerId).toBe('offer-a');
  });

  test('rejects route matches beyond the configured detour limit', () => {
    const plan = calculateCarpoolPlan(
      [{ id: 'offer', driverParticipantId: 'driver', seats: 1, origin: { id: 'o', label: 'O', latitude: 0, longitude: 0 } }],
      [{ id: 'request', participantId: 'rider', pickup: { id: 'r', label: 'R', latitude: 0, longitude: 0 } }],
      [{ offerId: 'offer', requestId: 'request', detourMinutes: 25, distanceKm: 12 }],
      { maxDetourMinutes: 20 },
    );
    expect(plan.matches).toEqual([]);
    expect(plan.unmatchedRequestIds).toEqual(['request']);
  });

  test('fails closed when a routing provider returns duplicate pair costs', () => {
    expect(() =>
      calculateCarpoolPlan(
        [{ id: 'offer', driverParticipantId: 'driver', seats: 1, origin: { id: 'o', label: 'O', latitude: 0, longitude: 0 } }],
        [{ id: 'request', participantId: 'rider', pickup: { id: 'r', label: 'R', latitude: 0, longitude: 0 } }],
        [
          { offerId: 'offer', requestId: 'request', detourMinutes: 5, distanceKm: 3 },
          { offerId: 'offer', requestId: 'request', detourMinutes: 25, distanceKm: 12 },
        ],
      ),
    ).toThrow('Duplicate route cost');
  });
});
