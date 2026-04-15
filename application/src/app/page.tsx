"use client";

import MapView from "./components/MapView";

const testPlaces = [
  { name: "Eiffel Tower", lat: 48.8584, lng: 2.2945 },
  { name: "Louvre Museum", lat: 48.8606, lng: 2.3376 },
  { name: "Notre Dame", lat: 48.8530, lng: 2.3499 },
];

export default function Home() {
  return (
    <main className="w-full h-screen flex flex-col">
      <h1 className="w-full h-10 p-6 flex items-center justify-between text-2xl font-bold">
        <p>
          Itinerary Builder Concept
        </p>
        <p>-</p>
      </h1>
      <div className="w-full h-full">
        <MapView places={testPlaces} />

        <div className="z-10 absolute w-full bottom-0 flex flex-col items-center">
          <div className="w-1/2 h-32 flex flex-col items-center p-4 bg-white rounded-t-2xl">
            <p className="font-bold">Describe your Journey</p>
            <input className="bg-neutral-200" type="text"></input>
          </div>
        </div>
      </div>
    </main>
  );
}