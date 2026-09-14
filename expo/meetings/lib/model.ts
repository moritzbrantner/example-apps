export type Availability = 'available' | 'if-needed' | 'unavailable';

export type ParticipantIdentity =
  | { kind: 'guest'; guestId: string }
  | { kind: 'account'; accountId: string };

export interface Participant {
  id: string;
  displayName: string;
  identity: ParticipantIdentity;
}

export interface Group {
  id: string;
  name: string;
}

export type MeetingScope = { kind: 'standalone' } | { kind: 'group'; groupId: string };

export interface DateOption {
  id: string;
  start: string;
  end: string;
}

export interface AvailabilityResponse {
  participantId: string;
  dateOptionId: string;
  status: Availability;
}

export type BringItemStatus = 'needed' | 'packed' | 'brought';

export interface BringItem {
  id: string;
  label: string;
  quantity: string;
  assigneeParticipantId: string | null;
  status: BringItemStatus;
}

export interface GeoPoint {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

export interface RideOffer {
  id: string;
  driverParticipantId: string;
  seats: number;
  origin: GeoPoint;
}

export interface RideRequest {
  id: string;
  participantId: string;
  pickup: GeoPoint;
}

export interface Meeting {
  id: string;
  title: string;
  scope: MeetingScope;
  destination: GeoPoint;
  participants: Participant[];
  dateOptions: DateOption[];
  availability: AvailabilityResponse[];
  confirmedDateOptionId: string | null;
  bringItems: BringItem[];
  rideOffers: RideOffer[];
  rideRequests: RideRequest[];
}
