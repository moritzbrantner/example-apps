import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { calculateCarpoolPlan, type RouteCost } from '../lib/carpool';
import { recordAvailability } from '../lib/commands';
import type { Availability, Meeting } from '../lib/model';
import { getBringReminders, rankDateOptions } from '../lib/queries';

const currentParticipantId = 'maria';

const initialMeeting: Meeting = {
  id: 'meeting-1',
  title: 'Autumn planning evening',
  scope: { kind: 'group', groupId: 'neighborhood-group' },
  destination: {
    id: 'hall',
    label: 'Community hall',
    latitude: 48.7758,
    longitude: 9.1829,
  },
  participants: [
    { id: 'maria', displayName: 'Maria', identity: { kind: 'guest', guestId: 'guest-maria' } },
    { id: 'jonas', displayName: 'Jonas', identity: { kind: 'account', accountId: 'account-jonas' } },
    { id: 'lea', displayName: 'Lea', identity: { kind: 'guest', guestId: 'guest-lea' } },
    { id: 'sam', displayName: 'Sam', identity: { kind: 'account', accountId: 'account-sam' } },
  ],
  dateOptions: [
    { id: 'fri', start: '2026-09-18T18:30:00+02:00', end: '2026-09-18T20:30:00+02:00' },
    { id: 'sat', start: '2026-09-19T17:00:00+02:00', end: '2026-09-19T19:00:00+02:00' },
    { id: 'sun', start: '2026-09-20T16:00:00+02:00', end: '2026-09-20T18:00:00+02:00' },
  ],
  availability: [
    { participantId: 'jonas', dateOptionId: 'fri', status: 'available' },
    { participantId: 'jonas', dateOptionId: 'sat', status: 'if-needed' },
    { participantId: 'jonas', dateOptionId: 'sun', status: 'unavailable' },
    { participantId: 'lea', dateOptionId: 'fri', status: 'available' },
    { participantId: 'lea', dateOptionId: 'sat', status: 'available' },
    { participantId: 'lea', dateOptionId: 'sun', status: 'if-needed' },
    { participantId: 'sam', dateOptionId: 'fri', status: 'if-needed' },
    { participantId: 'sam', dateOptionId: 'sat', status: 'available' },
    { participantId: 'sam', dateOptionId: 'sun', status: 'available' },
  ],
  confirmedDateOptionId: null,
  bringItems: [
    { id: 'projector', label: 'Projector', quantity: '1', assigneeParticipantId: 'maria', status: 'needed' },
    { id: 'cups', label: 'Reusable cups', quantity: '12', assigneeParticipantId: 'lea', status: 'packed' },
    { id: 'notes', label: 'Last meeting notes', quantity: '1 folder', assigneeParticipantId: 'maria', status: 'packed' },
  ],
  rideOffers: [
    {
      id: 'jonas-car',
      driverParticipantId: 'jonas',
      seats: 2,
      origin: { id: 'west', label: 'West side', latitude: 48.78, longitude: 9.13 },
    },
    {
      id: 'sam-car',
      driverParticipantId: 'sam',
      seats: 1,
      origin: { id: 'north', label: 'North side', latitude: 48.82, longitude: 9.18 },
    },
  ],
  rideRequests: [
    {
      id: 'maria-ride',
      participantId: 'maria',
      pickup: { id: 'maria-pickup', label: 'Feuersee area', latitude: 48.772, longitude: 9.165 },
    },
    {
      id: 'lea-ride',
      participantId: 'lea',
      pickup: { id: 'lea-pickup', label: 'Pragfriedhof area', latitude: 48.801, longitude: 9.187 },
    },
  ],
};

const demoRouteCosts: RouteCost[] = [
  { offerId: 'jonas-car', requestId: 'maria-ride', detourMinutes: 6, distanceKm: 3.7 },
  { offerId: 'sam-car', requestId: 'maria-ride', detourMinutes: 18, distanceKm: 8.1 },
  { offerId: 'jonas-car', requestId: 'lea-ride', detourMinutes: 14, distanceKm: 7.2 },
  { offerId: 'sam-car', requestId: 'lea-ride', detourMinutes: 5, distanceKm: 2.8 },
];

const availabilityOptions: Availability[] = ['available', 'if-needed', 'unavailable'];
const statusLabel: Record<Availability, string> = {
  available: 'Available',
  'if-needed': 'If needed',
  unavailable: 'Unavailable',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function HomeScreen() {
  const [meeting, setMeeting] = useState(initialMeeting);
  const rankings = useMemo(() => rankDateOptions(meeting), [meeting]);
  const reminders = useMemo(
    () => getBringReminders(meeting, currentParticipantId),
    [meeting],
  );
  const carpoolPlan = useMemo(
    () => calculateCarpoolPlan(meeting.rideOffers, meeting.rideRequests, demoRouteCosts),
    [meeting.rideOffers, meeting.rideRequests],
  );
  const participantById = useMemo(
    () => new Map(meeting.participants.map((participant) => [participant.id, participant])),
    [meeting.participants],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Meeting Planner · group meeting</Text>
          <Text style={styles.title}>{meeting.title}</Text>
          <Text style={styles.muted}>{meeting.destination.label}</Text>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>You joined as a guest</Text>
          <Text style={styles.bodyText}>
            Your answers and responsibilities belong to this participant identity. Creating an
            account later can claim the same identity without changing commitments.
          </Text>
          <Pressable style={styles.secondaryButton} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Create optional account</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Proposed dates</Text>
          <Text style={styles.bodyText}>
            Available, if needed, and unavailable remain separate signals. The ranking policy lives
            in the domain rather than the view.
          </Text>
          {rankings.map((ranking, index) => {
            const current = meeting.availability.find(
              (response) =>
                response.participantId === currentParticipantId &&
                response.dateOptionId === ranking.option.id,
            )?.status;
            return (
              <View style={styles.card} key={ranking.option.id}>
                <View style={styles.rowBetween}>
                  <View style={styles.grow}>
                    <Text style={styles.cardTitle}>{formatDate(ranking.option.start)}</Text>
                    <Text style={styles.muted}>
                      {ranking.available} available · {ranking.ifNeeded} if needed ·{' '}
                      {ranking.unavailable} unavailable · {ranking.unanswered} unanswered
                    </Text>
                  </View>
                  {index === 0 ? <Text style={styles.bestBadge}>Best fit</Text> : null}
                </View>
                <View style={styles.choiceRow}>
                  {availabilityOptions.map((status) => (
                    <Pressable
                      key={status}
                      accessibilityRole="button"
                      accessibilityState={{ selected: current === status }}
                      style={[styles.choice, current === status && styles.choiceSelected]}
                      onPress={() =>
                        setMeeting((value) =>
                          recordAvailability(value, currentParticipantId, ranking.option.id, status),
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.choiceText,
                          current === status && styles.choiceTextSelected,
                        ]}
                      >
                        {statusLabel[status]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What you need to bring</Text>
          {reminders.length === 0 ? (
            <Text style={styles.bodyText}>Nothing assigned to you.</Text>
          ) : (
            reminders.map((reminder) => (
              <View style={styles.card} key={reminder.itemId}>
                <Text style={styles.cardTitle}>{reminder.label}</Text>
                <Text style={styles.muted}>
                  {reminder.quantity} · {reminder.status === 'packed' ? 'Packed' : 'Still needed'}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calculated carpools</Text>
          <Text style={styles.bodyText}>
            The optimizer maximizes seated passengers first, then minimizes total route detour. A
            routing adapter supplies road travel costs; seat allocation stays in the meeting domain.
          </Text>
          {carpoolPlan.matches.map((match) => (
            <View style={styles.card} key={match.requestId}>
              <Text style={styles.cardTitle}>
                {participantById.get(match.passengerParticipantId)?.displayName ?? 'Passenger'} →{' '}
                {participantById.get(match.driverParticipantId)?.displayName ?? 'Driver'}
              </Text>
              <Text style={styles.muted}>
                +{match.detourMinutes} min detour · {match.distanceKm.toFixed(1)} km route impact
              </Text>
            </View>
          ))}
          {carpoolPlan.unmatchedRequestIds.length > 0 ? (
            <Text style={styles.warning}>
              {carpoolPlan.unmatchedRequestIds.length} passenger request(s) still need a ride.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f6f2' },
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, gap: 24 },
  header: { gap: 5 },
  eyebrow: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800' },
  muted: { fontSize: 14, lineHeight: 20, opacity: 0.65 },
  notice: { borderWidth: 1, borderColor: '#d6d0c4', borderRadius: 16, padding: 16, gap: 10, backgroundColor: '#fff' },
  noticeTitle: { fontSize: 18, fontWeight: '750' },
  bodyText: { fontSize: 15, lineHeight: 22, opacity: 0.78 },
  secondaryButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#292722', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  secondaryButtonText: { fontWeight: '700' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 22, fontWeight: '800' },
  card: { borderWidth: 1, borderColor: '#ded9ce', borderRadius: 16, padding: 15, gap: 10, backgroundColor: '#fff' },
  cardTitle: { fontSize: 17, fontWeight: '750' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  grow: { flex: 1, gap: 3 },
  bestBadge: { fontSize: 12, fontWeight: '800', borderWidth: 1, borderColor: '#2d5f3d', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderColor: '#c8c2b7', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  choiceSelected: { backgroundColor: '#292722', borderColor: '#292722' },
  choiceText: { fontSize: 13, fontWeight: '650' },
  choiceTextSelected: { color: '#fff' },
  warning: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
});
