import type { Availability, DateOption, Meeting } from './model';

export interface AvailabilityPolicy {
  availableWeight: number;
  ifNeededWeight: number;
  unavailableWeight: number;
  unansweredWeight: number;
}

export const defaultAvailabilityPolicy: AvailabilityPolicy = {
  availableWeight: 3,
  ifNeededWeight: 1,
  unavailableWeight: -4,
  unansweredWeight: -1,
};

export interface DateOptionRanking {
  option: DateOption;
  available: number;
  ifNeeded: number;
  unavailable: number;
  unanswered: number;
  score: number;
}

type AvailabilityCounts = Record<Availability, number>;

function emptyAvailabilityCounts(): AvailabilityCounts {
  return {
    available: 0,
    'if-needed': 0,
    unavailable: 0,
  };
}

function countStatusesByDateOption(meeting: Meeting): Map<string, AvailabilityCounts> {
  const countsByDateOption = new Map(
    meeting.dateOptions.map((option) => [option.id, emptyAvailabilityCounts()]),
  );

  for (const response of meeting.availability) {
    const counts = countsByDateOption.get(response.dateOptionId);
    if (counts) {
      counts[response.status] += 1;
    }
  }

  return countsByDateOption;
}

export function rankDateOptions(
  meeting: Meeting,
  policy: AvailabilityPolicy = defaultAvailabilityPolicy,
): DateOptionRanking[] {
  const countsByDateOption = countStatusesByDateOption(meeting);

  return meeting.dateOptions
    .map((option) => {
      const counts = countsByDateOption.get(option.id) ?? emptyAvailabilityCounts();
      const answered = counts.available + counts['if-needed'] + counts.unavailable;
      const unanswered = Math.max(0, meeting.participants.length - answered);
      const score =
        counts.available * policy.availableWeight +
        counts['if-needed'] * policy.ifNeededWeight +
        counts.unavailable * policy.unavailableWeight +
        unanswered * policy.unansweredWeight;
      return {
        option,
        available: counts.available,
        ifNeeded: counts['if-needed'],
        unavailable: counts.unavailable,
        unanswered,
        score,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.available - left.available ||
        left.unavailable - right.unavailable ||
        left.option.start.localeCompare(right.option.start) ||
        left.option.id.localeCompare(right.option.id),
    );
}

export interface BringReminder {
  itemId: string;
  label: string;
  quantity: string;
  status: 'needed' | 'packed';
}

export function getBringReminders(meeting: Meeting, participantId: string): BringReminder[] {
  return meeting.bringItems
    .filter(
      (item) => item.assigneeParticipantId === participantId && item.status !== 'brought',
    )
    .map((item) => ({
      itemId: item.id,
      label: item.label,
      quantity: item.quantity,
      status: item.status === 'packed' ? 'packed' : 'needed',
    }));
}
