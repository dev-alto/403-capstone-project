import { GoogleGenAI, Type } from '@google/genai';
import { NextResponse } from 'next/server';

import {
  buildScheduledStops,
  CATEGORY_TYPE_MAP,
  categoryLabelFor,
  type BudgetTier,
  type CategoryId,
  type Coordinates,
  haversineMiles,
  type ItineraryRequest,
  type ItineraryResponse,
  isBudgetTier,
  isCategoryId,
  isTransportMode,
  isWithinBudget,
  milesToMeters,
  type PhotoAttribution,
  type PlaceCandidate,
  type PlacePhoto,
  priceLevelToLabel,
  roundMiles,
  timeStringToMinutes,
} from '@/lib/itinerary';

export const runtime = 'nodejs';

const PLACES_BASE_URL = 'https://places.googleapis.com/v1';
const MAX_RADIUS_MILES = 25;
const MAX_STOP_COUNT = 8;
const NEARBY_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.priceLevel',
  'places.rating',
  'places.userRatingCount',
  'places.photos',
  'places.editorialSummary',
  'places.generativeSummary',
  'places.googleMapsUri',
].join(',');
const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'primaryType',
  'primaryTypeDisplayName',
  'types',
  'priceLevel',
  'rating',
  'userRatingCount',
  'photos',
  'editorialSummary',
  'generativeSummary',
  'googleMapsUri',
].join(',');

type GoogleLocalizedText = {
  text?: string;
  languageCode?: string;
};

type GooglePhoto = {
  name?: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: PhotoAttribution[];
};

type GooglePlace = {
  id?: string;
  displayName?: GoogleLocalizedText;
  formattedAddress?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  primaryType?: string;
  primaryTypeDisplayName?: GoogleLocalizedText;
  types?: string[];
  priceLevel?: string;
  rating?: number;
  userRatingCount?: number;
  photos?: GooglePhoto[];
  editorialSummary?: GoogleLocalizedText;
  generativeSummary?: unknown;
  googleMapsUri?: string;
};

type PlacesSearchResponse = {
  places?: GooglePlace[];
};

type GeminiPlanResponse = {
  summary?: string;
  stops?: Array<{
    placeId?: string;
    reason?: string;
  }>;
};

type GeminiPlan = {
  selectedIds: string[];
  summary: string;
};

class RequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function POST(request: Request) {
  try {
    // validate user input before paid api work
    const itineraryRequest = validateRequest(await request.json());
    const googleMapsApiKey = getGoogleMapsApiKey();
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!googleMapsApiKey) {
      throw new RequestError('Missing GOOGLE_MAPS_API_KEY.', 500);
    }

    if (!geminiApiKey) {
      throw new RequestError('Missing GEMINI_API_KEY.', 500);
    }

    // resolve the search center with google places
    const center = await resolveTripCenter(
      itineraryRequest.location,
      googleMapsApiKey,
    );

    // collect only places returned by google places
    const allCandidates = await collectCandidates(
      itineraryRequest,
      center.location,
      googleMapsApiKey,
    );

    if (allCandidates.length === 0) {
      throw new RequestError('No verified places were found for those filters.', 404);
    }

    // prefer budget matches but keep fallbacks when results are sparse
    const budgetCandidates = allCandidates.filter(
      (candidate) => candidate.budgetMatched,
    );
    const planningCandidates =
      budgetCandidates.length >= Math.min(itineraryRequest.stopCount, allCandidates.length)
        ? budgetCandidates
        : allCandidates;
    const diversePlanningCandidates = buildDiverseCandidatePool(
      planningCandidates,
      itineraryRequest.categories,
    );

    const geminiPlan = await chooseStopsWithGemini(
      itineraryRequest,
      diversePlanningCandidates.slice(0, 60),
      geminiApiKey,
    );
    const candidateById = new Map(
      diversePlanningCandidates.map((candidate) => [
        candidate.placeId,
        candidate,
      ]),
    );

    // reject any model choice that is not in the verified pool
    const selectedCandidates = selectVerifiedCandidates(
      geminiPlan.selectedIds,
      diversePlanningCandidates,
      candidateById,
      itineraryRequest.stopCount,
      itineraryRequest.categories,
    );
    // fetch details after selection to limit google places detail calls
    const enrichedCandidates = await Promise.all(
      selectedCandidates.map(async (candidate) => {
        const detailed = await getPlaceDetails(
          candidate.placeId,
          candidate.category,
          center.location,
          itineraryRequest.budget,
          googleMapsApiKey,
        ).catch(() => null);

        return detailed ?? candidate;
      }),
    );

    const stops = buildScheduledStops(
      enrichedCandidates,
      center.location,
      itineraryRequest,
    );
    const response: ItineraryResponse = {
      center,
      request: itineraryRequest,
      stops,
      routeSummary: geminiPlan.summary.trim() || buildRouteSummary(stops),
      generatedAt: new Date().toISOString(),
      notes: buildNotes(itineraryRequest, allCandidates, planningCandidates, stops),
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Itinerary generation failed:', error);

    return NextResponse.json(
      { error: 'Failed to generate itinerary.' },
      { status: 500 },
    );
  }
}

function validateRequest(payload: unknown): ItineraryRequest {
  // keep validation strict so downstream calls can trust shape
  if (!payload || typeof payload !== 'object') {
    throw new RequestError('Request body must be a JSON object.');
  }

  const body = payload as Record<string, unknown>;
  const location = typeof body.location === 'string' ? body.location.trim() : '';
  const startTime = typeof body.startTime === 'string' ? body.startTime : '';
  const endTime = typeof body.endTime === 'string' ? body.endTime : '';
  const startMinutes = timeStringToMinutes(startTime);
  const endMinutes = timeStringToMinutes(endTime);
  const radiusMiles = Number(body.radiusMiles);
  const stopCount = Number(body.stopCount);
  const categories = Array.isArray(body.categories)
    ? Array.from(new Set(body.categories.filter(isCategoryId)))
    : [];

  if (location.length < 2) {
    throw new RequestError('Enter a location to plan around.');
  }

  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    throw new RequestError('Choose a valid start and end time.');
  }

  if (!Number.isFinite(radiusMiles) || radiusMiles <= 0 || radiusMiles > MAX_RADIUS_MILES) {
    throw new RequestError(`Radius must be between 0.1 and ${MAX_RADIUS_MILES} miles.`);
  }

  if (!Number.isInteger(stopCount) || stopCount < 1 || stopCount > MAX_STOP_COUNT) {
    throw new RequestError(`Stop count must be between 1 and ${MAX_STOP_COUNT}.`);
  }

  if (categories.length === 0) {
    throw new RequestError('Select at least one category.');
  }

  if (!isBudgetTier(body.budget)) {
    throw new RequestError('Choose a valid budget.');
  }

  if (!isTransportMode(body.transport)) {
    throw new RequestError('Choose a valid transport mode.');
  }

  return {
    location,
    startTime,
    endTime,
    budget: body.budget,
    categories,
    radiusMiles,
    stopCount,
    transport: body.transport,
  };
}

function getGoogleMapsApiKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

async function resolveTripCenter(
  textQuery: string,
  apiKey: string,
): Promise<ItineraryResponse['center']> {
  const response = await placesPost<PlacesSearchResponse>(
    'places:searchText',
    apiKey,
    'places.id,places.displayName,places.formattedAddress,places.location',
    {
      textQuery,
      maxResultCount: 1,
      languageCode: 'en',
    },
  );
  const place = response.places?.[0];
  const name = place?.displayName?.text;
  const location = readCoordinates(place);

  if (!place || !name || !location) {
    throw new RequestError('Could not verify that location with Google Places.', 404);
  }

  return {
    name,
    address: place.formattedAddress ?? name,
    location,
  };
}

async function collectCandidates(
  request: ItineraryRequest,
  center: Coordinates,
  apiKey: string,
): Promise<PlaceCandidate[]> {
  // query each requested category independently
  const nearbyResponses = await Promise.all(
    request.categories.map((category) =>
      searchNearbyCategory(category, request, center, apiKey),
    ),
  );
  const byId = new Map<string, PlaceCandidate>();

  for (const candidates of nearbyResponses) {
    for (const candidate of candidates) {
      const existing = byId.get(candidate.placeId);

      if (!existing || (candidate.budgetMatched && !existing.budgetMatched)) {
        byId.set(candidate.placeId, candidate);
      }
    }
  }

  return Array.from(byId.values()).sort(compareCandidates);
}

async function searchNearbyCategory(
  category: CategoryId,
  request: ItineraryRequest,
  center: Coordinates,
  apiKey: string,
): Promise<PlaceCandidate[]> {
  const response = await placesPost<PlacesSearchResponse>(
    'places:searchNearby',
    apiKey,
    NEARBY_FIELD_MASK,
    {
      includedTypes: CATEGORY_TYPE_MAP[category],
      maxResultCount: Math.min(20, Math.max(8, request.stopCount * 4)),
      rankPreference: 'POPULARITY',
      languageCode: 'en',
      locationRestriction: {
        circle: {
          center: {
            latitude: center.lat,
            longitude: center.lng,
          },
          radius: milesToMeters(request.radiusMiles),
        },
      },
    },
  );

  return (response.places ?? [])
    .map((place) => normalizePlace(place, category, center, request.budget))
    .filter((candidate): candidate is PlaceCandidate => {
      return candidate !== null && candidate.distanceFromCenterMiles <= request.radiusMiles + 0.1;
    });
}

async function getPlaceDetails(
  placeId: string,
  category: CategoryId,
  center: Coordinates,
  budget: BudgetTier,
  apiKey: string,
): Promise<PlaceCandidate | null> {
  const place = await placesGet<GooglePlace>(
    `places/${encodeURIComponent(placeId)}`,
    apiKey,
    DETAILS_FIELD_MASK,
  );

  return normalizePlace(place, category, center, budget);
}

function normalizePlace(
  place: GooglePlace,
  category: CategoryId,
  center: Coordinates,
  budget: BudgetTier,
): PlaceCandidate | null {
  // discard places that cannot be located or identified
  const placeId = place.id;
  const name = place.displayName?.text;
  const location = readCoordinates(place);

  if (!placeId || !name || !location) {
    return null;
  }

  const summary = readSummary(place);
  const categoryLabel = categoryLabelFor(category);
  const primaryTypeLabel = place.primaryTypeDisplayName?.text;
  const address = place.formattedAddress ?? 'Address unavailable';
  const distanceFromCenterMiles = roundMiles(haversineMiles(center, location));

  return {
    placeId,
    name,
    address,
    location,
    category,
    categoryLabel,
    primaryType: place.primaryType,
    primaryTypeLabel,
    description:
      summary.text ??
      `Verified ${primaryTypeLabel ?? categoryLabel.toLowerCase()} near ${address}.`,
    descriptionAttribution: summary.attribution,
    priceLevel: place.priceLevel,
    priceLabel: priceLevelToLabel(place.priceLevel),
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    distanceFromCenterMiles,
    photos: normalizePhotos(place.photos),
    googleMapsUri: place.googleMapsUri,
    budgetMatched: isWithinBudget(place.priceLevel, budget, category),
  };
}

function buildDiverseCandidatePool(
  candidates: PlaceCandidate[],
  categories: CategoryId[],
): PlaceCandidate[] {
  // interleave categories before gemini sees the candidate list
  const seen = new Set<string>();
  const categoryOrder = shuffleArray(categories);
  const grouped = new Map<CategoryId, PlaceCandidate[]>();

  for (const category of categories) {
    const group = candidates.filter((candidate) => candidate.category === category);
    const strongMatches = shuffleArray(group.slice(0, Math.min(12, group.length)));
    const remainingMatches = group.slice(strongMatches.length);

    grouped.set(category, [...strongMatches, ...remainingMatches]);
  }

  const diversePool: PlaceCandidate[] = [];
  let depth = 0;
  let addedInRound = true;

  while (addedInRound) {
    addedInRound = false;

    for (const category of categoryOrder) {
      const candidate = grouped.get(category)?.[depth];

      if (candidate && !seen.has(candidate.placeId)) {
        diversePool.push(candidate);
        seen.add(candidate.placeId);
        addedInRound = true;
      }
    }

    depth += 1;
  }

  for (const candidate of shuffleArray(candidates)) {
    if (!seen.has(candidate.placeId)) {
      diversePool.push(candidate);
      seen.add(candidate.placeId);
    }
  }

  return diversePool;
}

async function chooseStopsWithGemini(
  request: ItineraryRequest,
  candidates: PlaceCandidate[],
  apiKey: string,
): Promise<GeminiPlan> {
  // ask gemini to plan from ids not freeform place names
  const ai = new GoogleGenAI({ apiKey });
  const candidatePayload = candidates.map((candidate) => ({
    placeId: candidate.placeId,
    name: candidate.name,
    category: candidate.categoryLabel,
    primaryType: candidate.primaryTypeLabel ?? candidate.primaryType,
    price: candidate.priceLabel,
    rating: candidate.rating,
    address: candidate.address,
    distanceMiles: candidate.distanceFromCenterMiles,
    description: candidate.description,
  }));
  const varietySeed = Math.floor(Math.random() * 1_000_000);
  const prompt = `Select and order an itinerary from verified Google Places candidates only.
Return up to ${request.stopCount} unique stops. Use only placeId values from the candidates list.
Also write one concise sentence summarizing the main theme and vibe of the full route.
Prefer matches for budget ${request.budget}, category variety, practical nearby routing, and interesting descriptions.
Prioritize a varied route: include different selected categories and different primary place types whenever verified candidates allow it.
If the requested stop count is at least the number of selected categories, include at least one stop from each selected category with candidates before repeating a category.
Avoid choosing only the highest-rated or closest places; mix reliable popular places with distinctive options that create a more interesting route.
Use this variety seed to break ties and avoid returning the same route every time: ${varietySeed}.
Do not invent places, addresses, images, prices, or IDs.

Request:
${JSON.stringify({
    location: request.location,
    startTime: request.startTime,
    endTime: request.endTime,
    budget: request.budget,
    categories: request.categories,
    radiusMiles: request.radiusMiles,
    stopCount: request.stopCount,
    transport: request.transport,
  })}

Candidates:
${JSON.stringify(candidatePayload)}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: `One concise sentence describing the route's theme and vibe.`,
          },
          stops: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                placeId: {
                  type: Type.STRING,
                  description: 'A placeId copied exactly from the candidates list.',
                },
                reason: {
                  type: Type.STRING,
                  description: 'Brief reason this verified candidate belongs in the itinerary.',
                },
              },
              required: ['placeId'],
            },
          },
        },
        required: ['summary', 'stops'],
      },
      temperature: 0.65,
    },
  });
  const parsed = JSON.parse(response.text ?? '{}') as GeminiPlanResponse;

  return {
    selectedIds: (parsed.stops ?? [])
      .map((stop) => stop.placeId)
      .filter((placeId): placeId is string => typeof placeId === 'string'),
    summary: typeof parsed.summary === 'string' ? truncate(parsed.summary, 170) : '',
  };
}

function selectVerifiedCandidates(
  selectedIds: string[],
  candidates: PlaceCandidate[],
  candidateById: Map<string, PlaceCandidate>,
  stopCount: number,
  requestedCategories: CategoryId[],
): PlaceCandidate[] {
  // start with verified model picks then fill any gaps
  const selected: PlaceCandidate[] = [];
  const seen = new Set<string>();

  for (const placeId of selectedIds) {
    const candidate = candidateById.get(placeId);

    if (candidate && !seen.has(candidate.placeId)) {
      selected.push(candidate);
      seen.add(candidate.placeId);
    }

    if (selected.length >= stopCount) {
      return selected;
    }
  }

  for (const candidate of candidates) {
    if (!seen.has(candidate.placeId)) {
      selected.push(candidate);
      seen.add(candidate.placeId);
    }

    if (selected.length >= stopCount) {
      break;
    }
  }

  return rebalanceForCategoryDiversity(
    selected,
    candidates,
    requestedCategories,
    stopCount,
  );
}

function rebalanceForCategoryDiversity(
  selected: PlaceCandidate[],
  candidates: PlaceCandidate[],
  requestedCategories: CategoryId[],
  stopCount: number,
): PlaceCandidate[] {
  // swap in missing categories when verified candidates exist
  if (stopCount < 2 || requestedCategories.length < 2) {
    return selected;
  }

  const availableCategories = requestedCategories.filter((category) =>
    candidates.some((candidate) => candidate.category === category),
  );
  const targetCategories = shuffleArray(availableCategories).slice(
    0,
    Math.min(stopCount, availableCategories.length),
  );
  const selectedIds = new Set(selected.map((candidate) => candidate.placeId));
  const selectedCategoryCounts = countSelectedCategories(selected);

  for (const category of targetCategories) {
    if ((selectedCategoryCounts.get(category) ?? 0) > 0) {
      continue;
    }

    const replacement = candidates.find(
      (candidate) => candidate.category === category && !selectedIds.has(candidate.placeId),
    );
    const replaceIndex = selected.findIndex(
      (candidate) => (selectedCategoryCounts.get(candidate.category) ?? 0) > 1,
    );

    if (!replacement || replaceIndex === -1) {
      continue;
    }

    const removed = selected[replaceIndex];
    selectedIds.delete(removed.placeId);
    selectedCategoryCounts.set(
      removed.category,
      Math.max(0, (selectedCategoryCounts.get(removed.category) ?? 0) - 1),
    );

    selected[replaceIndex] = replacement;
    selectedIds.add(replacement.placeId);
    selectedCategoryCounts.set(
      replacement.category,
      (selectedCategoryCounts.get(replacement.category) ?? 0) + 1,
    );
  }

  return selected;
}

function countSelectedCategories(candidates: PlaceCandidate[]): Map<CategoryId, number> {
  const counts = new Map<CategoryId, number>();

  for (const candidate of candidates) {
    counts.set(candidate.category, (counts.get(candidate.category) ?? 0) + 1);
  }

  return counts;
}

function buildNotes(
  request: ItineraryRequest,
  allCandidates: PlaceCandidate[],
  planningCandidates: PlaceCandidate[],
  stops: PlaceCandidate[],
): string[] {
  // surface important caveats without blocking useful results
  const notes: string[] = [
    'Travel time is a simple estimate, not a live route calculation.',
  ];

  if (
    planningCandidates.length !==
    allCandidates.filter((candidate) => candidate.budgetMatched).length
  ) {
    notes.push('Some price-unavailable places were considered because strict budget matches were limited.');
  }

  if (stops.length < request.stopCount) {
    notes.push(`Only ${stops.length} verified places matched enough of the filters.`);
  }

  return notes;
}

function buildRouteSummary(stops: PlaceCandidate[]): string {
  if (stops.length === 0) {
    return 'A compact route built from verified places that match your selected filters.';
  }

  const categories = Array.from(new Set(stops.map((stop) => stop.categoryLabel.toLowerCase())));
  const names = stops.slice(0, 3).map((stop) => stop.name).join(', ');

  return truncate(
    `A ${categories.join(', ')} route with a ${stops.length > 2 ? 'varied' : 'focused'} local feel, anchored by ${names}.`,
    170,
  );
}

async function placesPost<T>(
  path: string,
  apiKey: string,
  fieldMask: string,
  body: Record<string, unknown>,
): Promise<T> {
  // centralize google places post headers and field masks
  const response = await fetch(`${PLACES_BASE_URL}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  return readPlacesResponse<T>(response);
}

async function placesGet<T>(
  path: string,
  apiKey: string,
  fieldMask: string,
): Promise<T> {
  const response = await fetch(`${PLACES_BASE_URL}/${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    cache: 'no-store',
  });

  return readPlacesResponse<T>(response);
}

async function readPlacesResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!response.ok) {
    throw new RequestError(readGoogleError(text), response.status);
  }

  return JSON.parse(text) as T;
}

function readGoogleError(text: string): string {
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };

    return parsed.error?.message ?? 'Google Places request failed.';
  } catch {
    return 'Google Places request failed.';
  }
}

function readCoordinates(place?: GooglePlace): Coordinates | null {
  const lat = place?.location?.latitude;
  const lng = place?.location?.longitude;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return null;
  }

  return { lat, lng };
}

function readSummary(place: GooglePlace): { text?: string; attribution?: string } {
  // prefer official summaries before falling back to generic copy
  if (place.editorialSummary?.text) {
    return { text: truncate(place.editorialSummary.text, 190) };
  }

  const summary = place.generativeSummary;

  if (!summary || typeof summary !== 'object') {
    return {};
  }

  const record = summary as Record<string, unknown>;
  const overview = record.overview;
  const disclosureText = typeof record.disclosureText === 'string' ? record.disclosureText : undefined;

  if (typeof overview === 'string') {
    return { text: truncate(overview, 190), attribution: disclosureText };
  }

  if (overview && typeof overview === 'object') {
    const overviewText = (overview as Record<string, unknown>).text;

    if (typeof overviewText === 'string') {
      return { text: truncate(overviewText, 190), attribution: disclosureText };
    }
  }

  return {};
}

function normalizePhotos(photos?: GooglePhoto[]): PlacePhoto[] {
  return (photos ?? [])
    .filter((photo): photo is GooglePhoto & { name: string } => typeof photo.name === 'string')
    .slice(0, 2)
    .map((photo) => ({
      name: photo.name,
      widthPx: photo.widthPx,
      heightPx: photo.heightPx,
      authorAttributions: photo.authorAttributions ?? [],
    }));
}

function compareCandidates(first: PlaceCandidate, second: PlaceCandidate): number {
  // sort for reliable results before adding controlled randomness
  const firstBudgetRank = first.budgetMatched ? 0 : 1;
  const secondBudgetRank = second.budgetMatched ? 0 : 1;

  if (firstBudgetRank !== secondBudgetRank) {
    return firstBudgetRank - secondBudgetRank;
  }

  const ratingDelta = (second.rating ?? 0) - (first.rating ?? 0);

  if (Math.abs(ratingDelta) > 0.1) {
    return ratingDelta;
  }

  return first.distanceFromCenterMiles - second.distanceFromCenterMiles;
}

function shuffleArray<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const item = shuffled[index];

    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = item;
  }

  return shuffled;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}...`;
}
