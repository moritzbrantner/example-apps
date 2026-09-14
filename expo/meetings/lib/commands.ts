import type { Availability, BringItemStatus, Meeting } from './model';

function requireParticipant(meeting: Meeting, participantId: string) {
  if (!meeting.participants.some((participant) => participant.id === participantId)) {
    throw new Error(`Unknown participant: ${participantId}`);
  }
}

function requireDateOption(meeting: Meeting, dateOptionId: string) {
  if (!meeting.dateOptions.some((option) => option.id === dateOptionId)) {
    throw new Error(`Unknown date option: ${dateOptionId}`);
  }
}

export function recordAvailability(
  meeting: Meeting,
  participantId: string,
  dateOptionId: string,
  status: Availability,
): Meeting {
  requireParticipant(meeting, participantId);
  requireDateOption(meeting, dateOptionId);
  return {
    ...meeting,
    availability: [
      ...meeting.availability.filter(
        (response) =>
          response.participantId !== participantId || response.dateOptionId !== dateOptionId,
      ),
      { participantId, dateOptionId, status },
    ],
  };
}

export function confirmDate(meeting: Meeting, dateOptionId: string): Meeting {
  requireDateOption(meeting, dateOptionId);
  return { ...meeting, confirmedDateOptionId: dateOptionId };
}

export function claimGuestParticipant(
  meeting: Meeting,
  participantId: string,
  accountId: string,
): Meeting {
  requireParticipant(meeting, participantId);
  return {
    ...meeting,
    participants: meeting.participants.map((participant) => {
      if (participant.id !== participantId) return participant;
      if (participant.identity.kind === 'account') return participant;
      return { ...participant, identity: { kind: 'account' as const, accountId } };
    }),
  };
}

export function assignBringItem(
  meeting: Meeting,
  itemId: string,
  participantId: string | null,
): Meeting {
  if (participantId !== null) requireParticipant(meeting, participantId);
  if (!meeting.bringItems.some((item) => item.id === itemId)) {
    throw new Error(`Unknown bring item: ${itemId}`);
  }
  return {
    ...meeting,
    bringItems: meeting.bringItems.map((item) =>
      item.id === itemId ? { ...item, assigneeParticipantId: participantId } : item,
    ),
  };
}

export function setBringItemStatus(
  meeting: Meeting,
  itemId: string,
  status: BringItemStatus,
): Meeting {
  if (!meeting.bringItems.some((item) => item.id === itemId)) {
    throw new Error(`Unknown bring item: ${itemId}`);
  }
  return {
    ...meeting,
    bringItems: meeting.bringItems.map((item) =>
      item.id === itemId ? { ...item, status } : item,
    ),
  };
}
