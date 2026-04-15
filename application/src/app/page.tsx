"use client";

import MapView from "./components/MapView";

const testPlaces = [
  { name: "Eiffel Tower", lat: 48.8584, lng: 2.2945 },
  { name: "Louvre Museum", lat: 48.8606, lng: 2.3376 },
  { name: "Notre Dame", lat: 48.8530, lng: 2.3499 },
];

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Map Test</h1>
      <MapView places={testPlaces} />
    </main>
  );
}