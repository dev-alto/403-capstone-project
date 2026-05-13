export const CATEGORY_OPTIONS = [
  { id: "restaurants", label: "Restaurants" },
  { id: "event_centers", label: "Event Centers" },
  { id: "cultural", label: "Cultural" },
  { id: "entertainment", label: "Entertainment" },
  { id: "outdoors", label: "Outdoors" },
] as const;

export type CategoryId = (typeof CATEGORY_OPTIONS)[number]["id"];
export type BudgetTier = "free" | "$" | "$$" | "$$$";
export type TransportMode = "walking" | "driving" | "transit" | "biking";

export type Coordinates = {
  lat: number;
  lng: number;
};

export type PhotoAttribution = {
  displayName?: string;
  uri?: string;
  photoUri?: string;
};

export type PlacePhoto = {
  name: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions: PhotoAttribution[];
};

export type ItineraryRequest = {
  location: string;
  startTime: string;
  endTime: string;
  budget: BudgetTier;
  categories: CategoryId[];
  radiusMiles: number;
  stopCount: number;
  transport: TransportMode;
};

export type PlaceCandidate = {
  placeId: string;
  name: string;
  address: string;
  location: Coordinates;
  category: CategoryId;
  categoryLabel: string;
  primaryType?: string;
  primaryTypeLabel?: string;
  description: string;
  descriptionAttribution?: string;
  priceLevel?: string;
  priceLabel: string;
  rating?: number;
  userRatingCount?: number;
  distanceFromCenterMiles: number;
  photos: PlacePhoto[];
  googleMapsUri?: string;
  budgetMatched: boolean;
};

export type ItineraryStop = PlaceCandidate & {
  stopNumber: number;
  startTime: string;
  endTime: string;
  travelFromPreviousMiles: number;
  travelFromPreviousMinutes: number;
};

export type ItineraryResponse = {
  center: {
    name: string;
    address: string;
    location: Coordinates;
  };
  request: ItineraryRequest;
  stops: ItineraryStop[];
  routeSummary: string;
  generatedAt: string;
  notes: string[];
};

export const CATEGORY_TYPE_MAP: Record<CategoryId, string[]> = {
  restaurants: [
    "restaurant",
    "cafe",
    "bakery",
    "bar",
    "coffee_shop",
    "fast_food_restaurant",
    "food_court",
    "meal_takeaway",
  ],
  event_centers: [
    "event_venue",
    "convention_center",
    "concert_hall",
    "amphitheatre",
    "banquet_hall",
    "auditorium",
    "stadium",
    "arena",
  ],
  cultural: [
    "museum",
    "art_gallery",
    "cultural_landmark",
    "cultural_center",
    "historical_place",
    "historical_landmark",
    "monument",
    "performing_arts_theater",
  ],
  entertainment: [
    "amusement_center",
    "amusement_park",
    "aquarium",
    "bowling_alley",
    "casino",
    "comedy_club",
    "movie_theater",
    "night_club",
    "tourist_attraction",
    "zoo",
  ],
  outdoors: [
    "park",
    "garden",
    "botanical_garden",
    "hiking_area",
    "national_park",
    "state_park",
    "beach",
    "tourist_attraction",
  ],
};

const BUDGET_RANK: Record<BudgetTier, number> = {
  free: 0,
  $: 1,
  $$: 2,
  $$$: 3,
};

const PRICE_LEVEL_RANK: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 3,
};

const TRANSPORT_SPEED_MPH: Record<TransportMode, number> = {
  walking: 3,
  biking: 8,
  transit: 12,
  driving: 20,
};

export function categoryLabelFor(category: CategoryId): string {
  return CATEGORY_OPTIONS.find((option) => option.id === category)?.label ?? category;
}

export function isCategoryId(value: unknown): value is CategoryId {
  return (
    typeof value === "string" &&
    CATEGORY_OPTIONS.some((option) => option.id === value)
  );
}

export function isBudgetTier(value: unknown): value is BudgetTier {
  return value === "free" || value === "$" || value === "$$" || value === "$$$";
}

export function isTransportMode(value: unknown): value is TransportMode {
  return value === "walking" || value === "driving" || value === "transit" || value === "biking";
}

export function priceLevelToLabel(priceLevel?: string): string {
  switch (priceLevel) {
    case "PRICE_LEVEL_FREE":
      return "Free";
    case "PRICE_LEVEL_INEXPENSIVE":
      return "$";
    case "PRICE_LEVEL_MODERATE":
      return "$$";
    case "PRICE_LEVEL_EXPENSIVE":
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return "$$$";
    default:
      return "Price unavailable";
  }
}

export function isWithinBudget(
  priceLevel: string | undefined,
  budget: BudgetTier,
  category: CategoryId,
): boolean {
  const priceRank = priceLevel ? PRICE_LEVEL_RANK[priceLevel] : undefined;

  if (typeof priceRank === "number") {
    return priceRank <= BUDGET_RANK[budget];
  }

  return budget !== "free" || category === "outdoors" || category === "cultural";
}

export function milesToMeters(miles: number): number {
  return miles * 1609.344;
}

export function haversineMiles(from: Coordinates, to: Coordinates): number {
  const earthRadiusMiles = 3958.8;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) *
      Math.cos(toLat) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateTravelMinutes(
  distanceMiles: number,
  transport: TransportMode,
): number {
  if (distanceMiles <= 0.05) {
    return 0;
  }

  const travelMinutes = (distanceMiles / TRANSPORT_SPEED_MPH[transport]) * 60;
  const bufferMinutes = transport === "walking" ? 3 : 5;

  return roundUpToFive(Math.max(5, travelMinutes + bufferMinutes));
}

export function timeStringToMinutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);

  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToDisplayTime(totalMinutes: number): string {
  const minutesInDay = 24 * 60;
  const wrapped = ((Math.round(totalMinutes) % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;

  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export function roundMiles(miles: number): number {
  return Math.round(miles * 10) / 10;
}

export function buildScheduledStops(
  stops: PlaceCandidate[],
  center: Coordinates,
  request: Pick<ItineraryRequest, "startTime" | "endTime" | "transport">,
): ItineraryStop[] {
  const startMinutes = timeStringToMinutes(request.startTime) ?? 0;
  const endMinutes = timeStringToMinutes(request.endTime) ?? startMinutes + 180;
  const segmentTravel = stops.map((stop, index) => {
    const previousLocation = index === 0 ? center : stops[index - 1].location;
    const distance = haversineMiles(previousLocation, stop.location);

    return {
      distance,
      minutes: estimateTravelMinutes(distance, request.transport),
    };
  });

  const totalTravel = segmentTravel.reduce((sum, segment) => sum + segment.minutes, 0);
  const availableStopMinutes = Math.max(20 * stops.length, endMinutes - startMinutes - totalTravel);
  const dwellMinutes = Math.max(
    20,
    roundDownToFive(Math.min(90, availableStopMinutes / Math.max(1, stops.length))),
  );

  let cursor = startMinutes;

  return stops.map((stop, index) => {
    const travel = segmentTravel[index];
    const arrivalMinutes = roundUpToFive(cursor + travel.minutes);
    const leaveMinutes = Math.min(endMinutes, arrivalMinutes + dwellMinutes);

    cursor = leaveMinutes;

    return {
      ...stop,
      stopNumber: index + 1,
      startTime: minutesToDisplayTime(arrivalMinutes),
      endTime: minutesToDisplayTime(leaveMinutes),
      travelFromPreviousMiles: roundMiles(travel.distance),
      travelFromPreviousMinutes: travel.minutes,
    };
  });
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function roundUpToFive(minutes: number): number {
  return Math.ceil(minutes / 5) * 5;
}

function roundDownToFive(minutes: number): number {
  return Math.floor(minutes / 5) * 5;
}
