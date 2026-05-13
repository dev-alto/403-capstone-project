"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, LineString, Polygon } from "geojson";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

import {
  CATEGORY_OPTIONS,
  type BudgetTier,
  type CategoryId,
  type ItineraryRequest,
  type ItineraryResponse,
  type ItineraryStop,
  type TransportMode,
} from "@/lib/itinerary";

const budgetOptions: Array<{ value: BudgetTier; label: string }> = [
  { value: "free", label: "Free" },
  { value: "$", label: "$" },
  { value: "$$", label: "$$" },
  { value: "$$$", label: "$$$" },
];

const transportOptions: Array<{ value: TransportMode; label: string }> = [
  { value: "walking", label: "Walking" },
  { value: "driving", label: "Driving" },
  { value: "transit", label: "Transit" },
  { value: "biking", label: "Biking" },
];

const categoryStyles: Record<
  CategoryId,
  {
    activeButton: string;
    button: string;
    card: string;
    chip: string;
    pin: string;
  }
> = {
  restaurants: {
    activeButton: "border-orange-500 bg-orange-50 text-orange-700",
    button: "border-neutral-200 bg-white text-neutral-700 hover:border-orange-300",
    card: "border-orange-400 bg-orange-50",
    chip: "border-orange-300 bg-orange-100 text-orange-700",
    pin: "bg-orange-500",
  },
  event_centers: {
    activeButton: "border-sky-500 bg-sky-50 text-sky-700",
    button: "border-neutral-200 bg-white text-neutral-700 hover:border-sky-300",
    card: "border-sky-400 bg-sky-50",
    chip: "border-sky-300 bg-sky-100 text-sky-700",
    pin: "bg-sky-500",
  },
  cultural: {
    activeButton: "border-violet-500 bg-violet-50 text-violet-700",
    button: "border-neutral-200 bg-white text-neutral-700 hover:border-violet-300",
    card: "border-violet-400 bg-violet-50",
    chip: "border-violet-300 bg-violet-100 text-violet-700",
    pin: "bg-violet-500",
  },
  entertainment: {
    activeButton: "border-rose-500 bg-rose-50 text-rose-700",
    button: "border-neutral-200 bg-white text-neutral-700 hover:border-rose-300",
    card: "border-rose-400 bg-rose-50",
    chip: "border-rose-300 bg-rose-100 text-rose-700",
    pin: "bg-rose-500",
  },
  outdoors: {
    activeButton: "border-emerald-500 bg-emerald-50 text-emerald-700",
    button: "border-neutral-200 bg-white text-neutral-700 hover:border-emerald-300",
    card: "border-emerald-400 bg-emerald-50",
    chip: "border-emerald-300 bg-emerald-100 text-emerald-700",
    pin: "bg-emerald-500",
  },
};

const initialForm: ItineraryRequest = {
  location: "San Francisco, CA",
  startTime: "11:00",
  endTime: "16:00",
  budget: "$$",
  categories: ["restaurants", "cultural", "outdoors"],
  radiusMiles: 5,
  stopCount: 3,
  transport: "walking",
};

const defaultMapCenter = { lat: 37.7749, lng: -122.4194 };

const itineraryPathCasingLayer = {
  id: "itinerary-path-casing",
  type: "line",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": "#ffffff",
    "line-opacity": 0.9,
    "line-width": 8,
  },
} as const;

const itineraryPathLayer = {
  id: "itinerary-path-line",
  type: "line",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": "#2563eb",
    "line-opacity": 0.9,
    "line-width": 4,
  },
} as const;

const radiusFillLayer = {
  id: "itinerary-radius-fill",
  type: "fill",
  paint: {
    "fill-color": "#38bdf8",
    "fill-opacity": 0.12,
  },
} as const;

const radiusOutlineLayer = {
  id: "itinerary-radius-outline",
  type: "line",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": "#0284c7",
    "line-opacity": 0.8,
    "line-width": 2,
    "line-dasharray": [2, 2] as number[],
  },
} as const;

type MapboxDirectionsRoute = {
  geometry?: LineString;
};

type MapboxDirectionsResponse = {
  routes?: MapboxDirectionsRoute[];
  message?: string;
};

type HistoryItem = {
  id: string;
  savedAt: string;
  itinerary: ItineraryResponse;
};

const itineraryHistoryStorageKey = "itinerary-planner-history-v1";
const maxHistoryItems = 10;

export default function Home() {
  const mapRef = useRef<MapRef | null>(null);
  const [form, setForm] = useState<ItineraryRequest>(initialForm);
  const [itinerary, setItinerary] = useState<ItineraryResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [directionsLine, setDirectionsLine] = useState<LineString | null>(null);
  const [routeNotice, setRouteNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapCenter = itinerary?.center.location ?? defaultMapCenter;
  const mapKey = itinerary
    ? `${itinerary.center.location.lat}-${itinerary.center.location.lng}`
    : "default";
  const canSubmit =
    form.location.trim().length > 1 &&
    form.categories.length > 0 &&
    form.radiusMiles > 0 &&
    form.stopCount > 0;
  const selectedCategoryLabels = useMemo(
    () =>
      CATEGORY_OPTIONS.filter((option) => form.categories.includes(option.id))
        .map((option) => option.label)
        .join(", "),
    [form.categories],
  );

  useEffect(() => {
    setHistory(readHistoryItems());
  }, []);

  useEffect(() => {
    writeHistoryItems(history);
  }, [history]);

  const directPathLine = useMemo<LineString | null>(() => {
    if (!itinerary || itinerary.stops.length < 2) {
      return null;
    }

    return {
      type: "LineString",
      coordinates: itinerary.stops.map((stop) => [stop.location.lng, stop.location.lat]),
    };
  }, [itinerary]);
  const pathGeoJson = useMemo<FeatureCollection<LineString> | null>(() => {
    const line = directionsLine ?? directPathLine;

    if (!line) {
      return null;
    }

    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: line,
        },
      ],
    };
  }, [directionsLine, directPathLine]);
  const radiusGeoJson = useMemo<FeatureCollection<Polygon> | null>(() => {
    if (!itinerary) {
      return null;
    }

    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            radiusMiles: itinerary.request.radiusMiles,
          },
          geometry: buildRadiusCircle(
            itinerary.center.location,
            itinerary.request.radiusMiles,
          ),
        },
      ],
    };
  }, [itinerary]);

  useEffect(() => {
    if (!itinerary) {
      return;
    }

    const timer = window.setTimeout(() => fitMapToItinerary(itinerary), 120);

    return () => window.clearTimeout(timer);
  }, [itinerary]);

  useEffect(() => {
    if (!itinerary || !mapboxToken) {
      setDirectionsLine(null);
      setRouteNotice("");
      return;
    }

    const abortController = new AbortController();

    loadDirectionsRoute(itinerary, mapboxToken, abortController.signal);

    return () => abortController.abort();
  }, [itinerary, mapboxToken]);

  async function loadDirectionsRoute(
    currentItinerary: ItineraryResponse,
    accessToken: string,
    signal: AbortSignal,
  ) {
    setDirectionsLine(null);
    setRouteNotice("");

    const profile = mapboxProfileForTransport(currentItinerary.request.transport);
    const coordinates = currentItinerary.stops.map((stop) => stop.location);

    if (!profile) {
      setRouteNotice("Transit routing is not available in Mapbox Directions, so the map is showing a direct path.");
      return;
    }

    if (coordinates.length < 2) {
      return;
    }

    if (coordinates.length > 25) {
      setRouteNotice("The map is showing a direct path because Mapbox Directions supports up to 25 stop waypoints.");
      return;
    }

    const coordinateString = coordinates
      .map((coordinate) => `${coordinate.lng},${coordinate.lat}`)
      .join(";");
    const url = new URL(
      `https://api.mapbox.com/directions/v5/${profile}/${coordinateString}`,
    );
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("overview", "full");
    url.searchParams.set("steps", "false");
    url.searchParams.set("access_token", accessToken);

    try {
      const response = await fetch(url, { signal });
      const payload = (await response.json()) as MapboxDirectionsResponse;

      if (!response.ok || payload.routes?.[0]?.geometry?.type !== "LineString") {
        throw new Error(payload.message ?? "Mapbox Directions did not return a route.");
      }

      setDirectionsLine(payload.routes[0].geometry);
      setRouteNotice("");
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
        return;
      }

      setDirectionsLine(null);
      setRouteNotice("The map is showing a direct path because Mapbox Directions could not route these stops.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      setDirectionsLine(null);
      setRouteNotice("");
      const response = await fetch("/api/itinerary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not generate itinerary.");
      }

      const generatedItinerary = payload as ItineraryResponse;

      setItinerary(generatedItinerary);
      setHistory((currentHistory) => addHistoryItem(currentHistory, generatedItinerary));
      setIsHistoryOpen(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not generate itinerary.");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleCategory(category: CategoryId) {
    setForm((current) => {
      const hasCategory = current.categories.includes(category);
      const categories = hasCategory
        ? current.categories.filter((currentCategory) => currentCategory !== category)
        : [...current.categories, category];

      return { ...current, categories };
    });
  }

  function fitMapToItinerary(currentItinerary: ItineraryResponse) {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const coordinates = [
      currentItinerary.center.location,
      ...radiusBoundingCoordinates(
        currentItinerary.center.location,
        currentItinerary.request.radiusMiles,
      ),
    ];

    if (coordinates.length === 1) {
      map.flyTo({
        center: [coordinates[0].lng, coordinates[0].lat],
        zoom: 14,
        pitch: 0,
        bearing: 0,
        duration: 700,
      });
      return;
    }

    const bounds = coordinates.reduce(
      (currentBounds, coordinate) => {
        return {
          minLng: Math.min(currentBounds.minLng, coordinate.lng),
          minLat: Math.min(currentBounds.minLat, coordinate.lat),
          maxLng: Math.max(currentBounds.maxLng, coordinate.lng),
          maxLat: Math.max(currentBounds.maxLat, coordinate.lat),
        };
      },
      {
        minLng: coordinates[0].lng,
        minLat: coordinates[0].lat,
        maxLng: coordinates[0].lng,
        maxLat: coordinates[0].lat,
      },
    );

    map.fitBounds(
      [
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ],
      {
        padding: {
          top: 96,
          right: 96,
          bottom: 96,
          left: 96,
        },
        maxZoom: 15,
        duration: 900,
      },
    );
    map.easeTo({ pitch: 0, bearing: 0, duration: 900 });
  }

  function moveMapToStop(stop: ItineraryStop) {
    mapRef.current?.flyTo({
      center: [stop.location.lng, stop.location.lat],
      zoom: 17.35,
      pitch: 60,
      bearing: -35,
      duration: 850,
    });
  }

  function restoreHistoryItem(item: HistoryItem) {
    setItinerary(item.itinerary);
    setForm(item.itinerary.request);
    setDirectionsLine(null);
    setRouteNotice("");
    setError("");
    setIsHistoryOpen(false);
  }

  function removeHistoryItem(id: string) {
    setHistory((currentHistory) => currentHistory.filter((item) => item.id !== id));
  }

  return (
    <main className="relative h-screen w-full overflow-hidden bg-neutral-100 text-neutral-950">
      <div className="absolute inset-0">
        {mapboxToken ? (
          <Map
            key={mapKey}
            ref={mapRef}
            mapboxAccessToken={mapboxToken}
            onLoad={() => {
              if (itinerary) {
                fitMapToItinerary(itinerary);
              }
            }}
            initialViewState={{
              longitude: mapCenter.lng,
              latitude: mapCenter.lat,
              zoom: itinerary ? 12.4 : 16,
              pitch: itinerary ? 18 : 59.41,
              bearing: itinerary ? 0 : -72.78,
            }}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/skylinegdgoc/cmotm993e002001sx2b969hh3"
          >
            {radiusGeoJson && (
              <Source id="itinerary-radius" type="geojson" data={radiusGeoJson}>
                <Layer {...radiusFillLayer} />
                <Layer {...radiusOutlineLayer} />
              </Source>
            )}

            {pathGeoJson && (
              <Source id="itinerary-path" type="geojson" data={pathGeoJson}>
                <Layer {...itineraryPathCasingLayer} />
                <Layer {...itineraryPathLayer} />
              </Source>
            )}

            {itinerary && (
              <Marker
                longitude={itinerary.center.location.lng}
                latitude={itinerary.center.location.lat}
                anchor="center"
              >
                <div className="flex -translate-y-2 flex-col items-center gap-1">
                  <div className="max-w-40 rounded-md border border-neutral-200 bg-white px-2 py-1 text-center text-xs font-bold leading-tight text-neutral-800 shadow-md">
                    {itinerary.center.name}
                  </div>
                  <div className="h-4 w-4 rounded-full border-2 border-white bg-neutral-900 shadow-lg" />
                </div>
              </Marker>
            )}

            {itinerary?.stops.map((stop) => (
              <Marker
                key={stop.placeId}
                longitude={stop.location.lng}
                latitude={stop.location.lat}
                anchor="bottom"
              >
                <div className="flex -translate-y-1 flex-col items-center gap-1">
                  <div className="max-w-44 rounded-md border border-neutral-200 bg-white px-2 py-1 text-center text-xs font-bold leading-tight text-neutral-800 shadow-md">
                    {stop.name}
                  </div>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-sm font-bold text-white shadow-lg ${categoryStyles[stop.category].pin}`}
                  >
                    {stop.stopNumber}
                  </div>
                </div>
              </Marker>
            ))}
          </Map>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-200 text-sm font-medium text-neutral-500">
            Map preview unavailable
          </div>
        )}
      </div>

      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between bg-white/80 px-5 py-3 shadow-sm backdrop-blur md:px-8">
        <div>
          <h1 className="text-lg font-bold text-neutral-900 md:text-xl">
            Itinerary Planner
          </h1>
          <p className="text-xs font-medium text-neutral-500 md:text-sm">
            Group 7
          </p>
        </div>

        <div className="flex items-center gap-3">
          {itinerary && (
            <div className="hidden rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 shadow-sm md:block">
              {itinerary.stops.length} stops near {itinerary.center.name}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsHistoryOpen((isOpen) => !isOpen)}
            className="h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-700 shadow-sm transition hover:border-neutral-900 hover:text-neutral-950"
          >
            History
            {history.length > 0 ? ` (${history.length})` : ""}
          </button>
        </div>
      </header>

      {isHistoryOpen && (
        <HistoryPanel
          history={history}
          onClose={() => setIsHistoryOpen(false)}
          onRestore={restoreHistoryItem}
          onRemove={removeHistoryItem}
          onClear={() => setHistory([])}
        />
      )}

      <section
        className={`absolute bottom-0 left-0 right-0 z-20 max-h-[86vh] overflow-y-auto ${
          itinerary ? "px-0 pb-0" : "px-3 pb-3 md:px-6 md:pb-5"
        }`}
      >
        {!itinerary ? (
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex w-full max-w-6xl flex-col gap-4 rounded-t-2xl border border-neutral-200 bg-white p-4 shadow-2xl md:p-5"
          >
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1.4fr)_repeat(2,minmax(120px,0.45fr))]">
              <label className="flex flex-col gap-1 text-sm font-semibold text-neutral-700">
                Location
                <input
                  value={form.location}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, location: event.target.value }))
                  }
                  className="h-11 rounded-lg border border-neutral-300 bg-neutral-50 px-3 text-base font-medium text-neutral-950 outline-none transition focus:border-neutral-900 focus:bg-white"
                  placeholder="San Francisco, CA"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-neutral-700">
                Start Time
                <input
                  value={form.startTime}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, startTime: event.target.value }))
                  }
                  type="time"
                  className="h-11 rounded-lg border border-neutral-300 bg-neutral-50 px-3 text-base font-medium text-neutral-950 outline-none transition focus:border-neutral-900 focus:bg-white"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-neutral-700">
                End Time
                <input
                  value={form.endTime}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, endTime: event.target.value }))
                  }
                  type="time"
                  className="h-11 rounded-lg border border-neutral-300 bg-neutral-50 px-3 text-base font-medium text-neutral-950 outline-none transition focus:border-neutral-900 focus:bg-white"
                />
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-neutral-700">Categories</p>
                <p className="hidden text-xs font-medium text-neutral-500 md:block">
                  {selectedCategoryLabels || "None selected"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((category) => {
                  const isSelected = form.categories.includes(category.id);
                  const styles = categoryStyles[category.id];

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className={`h-10 rounded-lg border px-4 text-sm font-bold transition ${
                        isSelected ? styles.activeButton : styles.button
                      }`}
                    >
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <label className="flex flex-col gap-1 text-sm font-semibold text-neutral-700">
                Budget
                <select
                  value={form.budget}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      budget: event.target.value as BudgetTier,
                    }))
                  }
                  className="h-11 rounded-lg border border-neutral-300 bg-neutral-50 px-3 text-base font-medium text-neutral-950 outline-none transition focus:border-neutral-900 focus:bg-white"
                >
                  {budgetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-neutral-700">
                Radius
                <input
                  value={form.radiusMiles}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      radiusMiles: Number(event.target.value),
                    }))
                  }
                  type="number"
                  min="0.1"
                  max="25"
                  step="0.1"
                  className="h-11 rounded-lg border border-neutral-300 bg-neutral-50 px-3 text-base font-medium text-neutral-950 outline-none transition focus:border-neutral-900 focus:bg-white"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-neutral-700">
                Stops
                <input
                  value={form.stopCount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stopCount: Number(event.target.value),
                    }))
                  }
                  type="number"
                  min="1"
                  max="8"
                  step="1"
                  className="h-11 rounded-lg border border-neutral-300 bg-neutral-50 px-3 text-base font-medium text-neutral-950 outline-none transition focus:border-neutral-900 focus:bg-white"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-semibold text-neutral-700">
                Transport
                <select
                  value={form.transport}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      transport: event.target.value as TransportMode,
                    }))
                  }
                  className="h-11 rounded-lg border border-neutral-300 bg-neutral-50 px-3 text-base font-medium text-neutral-950 outline-none transition focus:border-neutral-900 focus:bg-white"
                >
                  {transportOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={!canSubmit || isLoading}
                className="mt-auto h-11 rounded-lg bg-neutral-950 px-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {isLoading ? "Generating..." : "Generate Itinerary"}
              </button>
            </div>

            {isLoading && (
              <div className="overflow-hidden rounded-full border border-blue-100 bg-blue-50">
                <div className="itinerary-loading-bar h-2 w-1/3 rounded-full bg-blue-600" />
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}
          </form>
        ) : (
          <ResultsPanel
            itinerary={itinerary}
            routeNotice={routeNotice}
            onStopSelect={moveMapToStop}
            onBack={() => {
              setItinerary(null);
              setDirectionsLine(null);
              setRouteNotice("");
              setError("");
            }}
          />
        )}
      </section>
    </main>
  );
}

function ResultsPanel({
  itinerary,
  routeNotice,
  onStopSelect,
  onBack,
}: {
  itinerary: ItineraryResponse;
  routeNotice: string;
  onStopSelect: (stop: ItineraryStop) => void;
  onBack: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const routeSummary = itinerary.routeSummary?.trim() || buildClientRouteSummary(itinerary);

  function selectStop(stop: ItineraryStop) {
    onStopSelect(stop);
    setIsExpanded(false);

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  return (
    <div
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onFocusCapture={() => setIsExpanded(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;

        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setIsExpanded(false);
        }
      }}
      className={`flex w-full flex-col gap-4 overflow-y-auto rounded-t-2xl border border-neutral-200 bg-white p-4 shadow-2xl transition-[max-height] duration-300 md:p-5 ${
        isExpanded ? "max-h-[86vh]" : "max-h-[20rem]"
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-neutral-500">Start</p>
          <h2 className="text-2xl font-bold text-neutral-950 md:text-3xl">
            {itinerary.center.name}
          </h2>
          <p className="text-sm font-medium text-neutral-500">{itinerary.center.address}</p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="h-10 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-bold text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-950"
        >
          Edit Search
        </button>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
        <p className="text-xs font-bold uppercase text-sky-700">Route vibe</p>
        <p className="mt-1 text-sm font-semibold leading-5 text-neutral-800">
          {routeSummary}
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-1">
        {itinerary.stops.map((stop, index) => (
          <div
            key={stop.placeId}
            className="min-w-[310px] max-w-[380px] flex-1 md:min-w-[420px]"
          >
            <TimelineStop
              stop={stop}
              isFirst={index === 0}
              isLast={index === itinerary.stops.length - 1}
            />
            <StopCard stop={stop} onSelect={selectStop} />
          </div>
        ))}
      </div>

      {itinerary.notes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {itinerary.notes.map((note) => (
            <span
              key={note}
              className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-500"
            >
              {note}
            </span>
          ))}
        </div>
      )}

      {routeNotice && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          {routeNotice}
        </div>
      )}
    </div>
  );
}

function HistoryPanel({
  history,
  onClose,
  onRestore,
  onRemove,
  onClear,
}: {
  history: HistoryItem[];
  onClose: () => void;
  onRestore: (item: HistoryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <aside className="absolute right-4 top-20 z-30 max-h-[70vh] w-[min(92vw,420px)] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 shadow-2xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-950">History</h2>
          <p className="text-sm font-medium text-neutral-500">
            Recent generated itineraries
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-950"
        >
          Close
        </button>
      </div>

      {history.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-sm font-semibold text-neutral-500">
          No saved itineraries yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {history.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-neutral-200 bg-neutral-50 p-3"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-neutral-950">
                    {item.itinerary.center.name}
                  </h3>
                  <p className="text-xs font-semibold text-neutral-500">
                    {formatHistoryDate(item.savedAt)} • {item.itinerary.stops.length} stops
                  </p>
                </div>
                <span className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-bold text-neutral-600">
                  {item.itinerary.request.budget}
                </span>
              </div>

              <p className="mb-3 max-h-10 overflow-hidden text-sm font-medium leading-5 text-neutral-700">
                {item.itinerary.routeSummary?.trim() || buildClientRouteSummary(item.itinerary)}
              </p>

              <div className="mb-3 flex flex-wrap gap-1">
                {item.itinerary.stops.slice(0, 4).map((stop) => (
                  <span
                    key={stop.placeId}
                    className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold text-neutral-600"
                  >
                    {stop.name}
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onRestore(item)}
                  className="h-9 flex-1 rounded-lg bg-neutral-950 px-3 text-sm font-bold text-white transition hover:bg-neutral-800"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="h-9 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-700 transition hover:border-red-300 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            </article>
          ))}

          <button
            type="button"
            onClick={onClear}
            className="h-9 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-700 transition hover:border-red-300 hover:text-red-700"
          >
            Clear History
          </button>
        </div>
      )}
    </aside>
  );
}

function TimelineStop({
  stop,
  isFirst,
  isLast,
}: {
  stop: ItineraryStop;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="relative mb-2 h-20">
      <div
        className="absolute top-4 h-2 rounded-full bg-sky-200"
        style={{
          left: isFirst ? "50%" : 0,
          right: isLast ? "50%" : 0,
        }}
      />
      <div className="absolute left-1/2 top-0 z-10 flex -translate-x-1/2 flex-col items-center">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-sm font-bold text-white shadow ${categoryStyles[stop.category].pin}`}
        >
          {stop.stopNumber}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-bold text-neutral-700 shadow-sm">
            {stop.startTime}
          </span>
          <span className="text-xs font-bold text-neutral-400">to</span>
          <span className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-bold text-neutral-700 shadow-sm">
            {stop.endTime}
          </span>
        </div>
        <p className="mt-1 whitespace-nowrap text-xs font-medium text-neutral-500">
          {stop.travelFromPreviousMiles} miles from previous
        </p>
      </div>
    </div>
  );
}

function StopCard({
  stop,
  onSelect,
}: {
  stop: ItineraryStop;
  onSelect: (stop: ItineraryStop) => void;
}) {
  const styles = categoryStyles[stop.category];

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(stop)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(stop);
        }
      }}
      className={`w-full cursor-pointer rounded-2xl border-2 p-3 text-left shadow-sm outline-none transition hover:-translate-y-1 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-neutral-900 md:p-4 ${styles.card}`}
    >
      <div className="mb-2 flex items-start justify-end">
        <span className={`rounded-lg border px-3 py-1 text-sm font-bold ${styles.chip}`}>
          {stop.categoryLabel}
        </span>
      </div>

      <p className="mb-1 text-sm font-semibold text-neutral-500">
        {stop.travelFromPreviousMiles} miles to
      </p>
      <p className="mb-2 text-sm font-bold text-neutral-700">{stop.address}</p>

      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-neutral-950">{stop.name}</h3>
          {stop.primaryTypeLabel && (
            <p className="mt-1 text-sm font-semibold text-neutral-500">
              {stop.primaryTypeLabel}
            </p>
          )}
        </div>
        <p className="shrink-0 text-lg font-bold text-neutral-700">{stop.priceLabel}</p>
      </div>

      <p className="mb-3 min-h-10 text-sm font-medium leading-5 text-neutral-700">
        {stop.description}
      </p>

      {stop.descriptionAttribution && (
        <p className="mb-3 text-xs font-semibold text-neutral-500">
          {stop.descriptionAttribution}
        </p>
      )}

      {stop.photos.length > 0 ? (
        <div className={`grid gap-3 ${stop.photos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {stop.photos.map((photo) => (
            <div key={photo.name}>
              <img
                src={photoUrl(photo.name)}
                alt={`${stop.name} photo`}
                className="h-28 w-full rounded-lg object-cover md:h-32"
              />
              {photo.authorAttributions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 text-xs font-medium text-neutral-500">
                  {photo.authorAttributions.map((attribution, index) =>
                    attribution.uri || attribution.photoUri ? (
                      <a
                        key={`${photo.name}-${attribution.displayName ?? index}`}
                        href={attribution.uri ?? attribution.photoUri}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="underline underline-offset-2"
                      >
                        {attribution.displayName ?? "Photo source"}
                      </a>
                    ) : (
                      <span key={`${photo.name}-${attribution.displayName ?? index}`}>
                        {attribution.displayName ?? "Photo source"}
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-28 w-full items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white/60 text-sm font-semibold text-neutral-400 md:h-32">
          No photo available
        </div>
      )}

      {stop.googleMapsUri && (
        <a
          href={stop.googleMapsUri}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="mt-4 inline-flex text-sm font-bold text-neutral-700 underline underline-offset-4"
        >
          Open in Google Maps
        </a>
      )}
    </article>
  );
}

function photoUrl(photoName: string): string {
  const params = new URLSearchParams({
    name: photoName,
    maxWidthPx: "720",
    maxHeightPx: "480",
  });

  return `/api/place-photo?${params.toString()}`;
}

function buildClientRouteSummary(itinerary: ItineraryResponse): string {
  if (itinerary.stops.length === 0) {
    return "A compact route built from verified places that match your selected filters.";
  }

  const categories = Array.from(
    new Set(itinerary.stops.map((stop) => stop.categoryLabel.toLowerCase())),
  );
  const names = itinerary.stops
    .slice(0, 3)
    .map((stop) => stop.name)
    .join(", ");

  return `A ${categories.join(", ")} route with a local feel, anchored by ${names}.`;
}

function addHistoryItem(
  currentHistory: HistoryItem[],
  itinerary: ItineraryResponse,
): HistoryItem[] {
  const item: HistoryItem = {
    id: `${itinerary.generatedAt}-${itinerary.center.name}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
    itinerary,
  };
  const dedupedHistory = currentHistory.filter(
    (historyItem) =>
      historyItem.itinerary.generatedAt !== itinerary.generatedAt &&
      historyItem.itinerary.center.name !== itinerary.center.name,
  );

  return [item, ...dedupedHistory].slice(0, maxHistoryItems);
}

function readHistoryItems(): HistoryItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(itineraryHistoryStorageKey);

    if (!storedValue) {
      return [];
    }

    const parsed = JSON.parse(storedValue) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isHistoryItem).slice(0, maxHistoryItems);
  } catch {
    return [];
  }
}

function writeHistoryItems(history: HistoryItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      itineraryHistoryStorageKey,
      JSON.stringify(history.slice(0, maxHistoryItems)),
    );
  } catch {
    // localStorage can be unavailable in private or restricted browser modes.
  }
}

function isHistoryItem(value: unknown): value is HistoryItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const itinerary = record.itinerary as Partial<ItineraryResponse> | undefined;

  return (
    typeof record.id === "string" &&
    typeof record.savedAt === "string" &&
    Boolean(itinerary?.center) &&
    Array.isArray(itinerary?.stops)
  );
}

function formatHistoryDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Saved itinerary";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function mapboxProfileForTransport(transport: TransportMode): string | null {
  switch (transport) {
    case "walking":
      return "mapbox/walking";
    case "driving":
      return "mapbox/driving";
    case "biking":
      return "mapbox/cycling";
    case "transit":
      return null;
  }
}

function buildRadiusCircle(
  center: { lat: number; lng: number },
  radiusMiles: number,
): Polygon {
  const earthRadiusMiles = 3958.8;
  const steps = 96;
  const centerLat = toRadians(center.lat);
  const centerLng = toRadians(center.lng);
  const angularDistance = radiusMiles / earthRadiusMiles;
  const coordinates: number[][] = [];

  for (let step = 0; step <= steps; step++) {
    const bearing = (step / steps) * 2 * Math.PI;
    const lat = Math.asin(
      Math.sin(centerLat) * Math.cos(angularDistance) +
        Math.cos(centerLat) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const lng =
      centerLng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(centerLat),
        Math.cos(angularDistance) - Math.sin(centerLat) * Math.sin(lat),
      );

    coordinates.push([toDegrees(lng), toDegrees(lat)]);
  }

  return {
    type: "Polygon",
    coordinates: [coordinates],
  };
}

function radiusBoundingCoordinates(
  center: { lat: number; lng: number },
  radiusMiles: number,
): Array<{ lat: number; lng: number }> {
  const latDelta = radiusMiles / 69;
  const lngDelta = radiusMiles / (69 * Math.max(0.2, Math.cos(toRadians(center.lat))));

  return [
    { lat: center.lat + latDelta, lng: center.lng },
    { lat: center.lat - latDelta, lng: center.lng },
    { lat: center.lat, lng: center.lng + lngDelta },
    { lat: center.lat, lng: center.lng - lngDelta },
  ];
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
