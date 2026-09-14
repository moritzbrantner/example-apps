import type { GeoPoint, RideOffer, RideRequest } from './model';

export interface RouteCost {
  offerId: string;
  requestId: string;
  detourMinutes: number;
  distanceKm: number;
}

export interface RoutingProviderInput {
  destination: GeoPoint;
  offers: RideOffer[];
  requests: RideRequest[];
}

export interface RoutingProvider {
  calculateRouteCosts(input: RoutingProviderInput): Promise<RouteCost[]>;
}

export interface CarpoolPolicy {
  maxDetourMinutes: number;
}

export const defaultCarpoolPolicy: CarpoolPolicy = {
  maxDetourMinutes: 20,
};

export interface CarpoolMatch {
  offerId: string;
  requestId: string;
  driverParticipantId: string;
  passengerParticipantId: string;
  detourMinutes: number;
  distanceKm: number;
}

export interface CarpoolPlan {
  matches: CarpoolMatch[];
  unmatchedRequestIds: string[];
  totalDetourMinutes: number;
}

type Edge = {
  to: number;
  reverseIndex: number;
  capacity: number;
  cost: number;
};

type PairEdge = {
  offerId: string;
  requestId: string;
  routeCost: RouteCost;
  edge: Edge;
};

function addEdge(graph: Edge[][], from: number, to: number, capacity: number, cost: number) {
  const forward: Edge = { to, reverseIndex: graph[to].length, capacity, cost };
  const reverse: Edge = { to: from, reverseIndex: graph[from].length, capacity: 0, cost: -cost };
  graph[from].push(forward);
  graph[to].push(reverse);
  return forward;
}

export function calculateCarpoolPlan(
  offersInput: RideOffer[],
  requestsInput: RideRequest[],
  routeCostsInput: RouteCost[],
  policy: CarpoolPolicy = defaultCarpoolPolicy,
): CarpoolPlan {
  const offerIdsByRequest = new Map<string, Set<string>>();
  for (const routeCost of routeCostsInput) {
    let offerIds = offerIdsByRequest.get(routeCost.requestId);
    if (!offerIds) {
      offerIds = new Set<string>();
      offerIdsByRequest.set(routeCost.requestId, offerIds);
    }
    if (offerIds.has(routeCost.offerId)) {
      throw new Error(
        `Duplicate route cost for request/offer pair: ${routeCost.requestId} / ${routeCost.offerId}`,
      );
    }
    offerIds.add(routeCost.offerId);
  }

  const offers = [...offersInput].sort((left, right) => left.id.localeCompare(right.id));
  const requests = [...requestsInput].sort((left, right) => left.id.localeCompare(right.id));
  const routeCosts = [...routeCostsInput]
    .filter(
      (cost) =>
        Number.isFinite(cost.detourMinutes) &&
        cost.detourMinutes >= 0 &&
        cost.detourMinutes <= policy.maxDetourMinutes,
    )
    .sort(
      (left, right) =>
        left.requestId.localeCompare(right.requestId) ||
        left.offerId.localeCompare(right.offerId) ||
        left.detourMinutes - right.detourMinutes,
    );

  const source = 0;
  const requestOffset = 1;
  const offerOffset = requestOffset + requests.length;
  const sink = offerOffset + offers.length;
  const nodeCount = sink + 1;
  const graph: Edge[][] = Array.from({ length: nodeCount }, () => []);
  const requestIndex = new Map(requests.map((request, index) => [request.id, requestOffset + index]));
  const offerIndex = new Map(offers.map((offer, index) => [offer.id, offerOffset + index]));
  const pairEdges: PairEdge[] = [];

  for (const request of requests) addEdge(graph, source, requestIndex.get(request.id)!, 1, 0);
  for (const offer of offers) {
    const seats = Math.max(0, Math.floor(offer.seats));
    if (seats > 0) addEdge(graph, offerIndex.get(offer.id)!, sink, seats, 0);
  }

  for (const routeCost of routeCosts) {
    const from = requestIndex.get(routeCost.requestId);
    const to = offerIndex.get(routeCost.offerId);
    if (from === undefined || to === undefined) continue;
    const edge = addEdge(graph, from, to, 1, Math.round(routeCost.detourMinutes * 1000));
    pairEdges.push({
      offerId: routeCost.offerId,
      requestId: routeCost.requestId,
      routeCost,
      edge,
    });
  }

  while (true) {
    const distance = Array<number>(nodeCount).fill(Number.POSITIVE_INFINITY);
    const previousNode = Array<number>(nodeCount).fill(-1);
    const previousEdge = Array<number>(nodeCount).fill(-1);
    distance[source] = 0;

    for (let iteration = 0; iteration < nodeCount - 1; iteration += 1) {
      let changed = false;
      for (let from = 0; from < nodeCount; from += 1) {
        if (!Number.isFinite(distance[from])) continue;
        for (let edgeIndex = 0; edgeIndex < graph[from].length; edgeIndex += 1) {
          const edge = graph[from][edgeIndex];
          if (edge.capacity <= 0) continue;
          const candidate = distance[from] + edge.cost;
          if (candidate < distance[edge.to]) {
            distance[edge.to] = candidate;
            previousNode[edge.to] = from;
            previousEdge[edge.to] = edgeIndex;
            changed = true;
          }
        }
      }
      if (!changed) break;
    }

    if (!Number.isFinite(distance[sink])) break;

    let node = sink;
    while (node !== source) {
      const from = previousNode[node];
      const edgeIndex = previousEdge[node];
      if (from < 0 || edgeIndex < 0) throw new Error('Invalid residual carpool path');
      const edge = graph[from][edgeIndex];
      edge.capacity -= 1;
      graph[edge.to][edge.reverseIndex].capacity += 1;
      node = from;
    }
  }

  const offerById = new Map(offers.map((offer) => [offer.id, offer]));
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const matches = pairEdges
    .filter((pair) => pair.edge.capacity === 0)
    .map((pair) => {
      const offer = offerById.get(pair.offerId)!;
      const request = requestById.get(pair.requestId)!;
      return {
        offerId: pair.offerId,
        requestId: pair.requestId,
        driverParticipantId: offer.driverParticipantId,
        passengerParticipantId: request.participantId,
        detourMinutes: pair.routeCost.detourMinutes,
        distanceKm: pair.routeCost.distanceKm,
      };
    })
    .sort(
      (left, right) =>
        left.requestId.localeCompare(right.requestId) || left.offerId.localeCompare(right.offerId),
    );
  const matchedRequestIds = new Set(matches.map((match) => match.requestId));
  return {
    matches,
    unmatchedRequestIds: requests
      .filter((request) => !matchedRequestIds.has(request.id))
      .map((request) => request.id),
    totalDetourMinutes: matches.reduce((sum, match) => sum + match.detourMinutes, 0),
  };
}
