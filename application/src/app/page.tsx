"use client"

import { useState } from "react"

import MapView from "./components/MapView"

import Map from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

const testPlaces = [
  { name: "Eiffel Tower", lat: 48.8584, lng: 2.2945 },
  { name: "Louvre Museum", lat: 48.8606, lng: 2.3376 },
  { name: "Notre Dame", lat: 48.8530, lng: 2.3499 },
]

export default function Home() {

  const [showResults, setShowResults] = useState(false)

  return (
    <main className="relative w-full h-screen overflow-hidden">

      {/* TOP NAVBAR */}
      <div className="absolute top-0 z-20 w-full px-8 py-5 flex items-center justify-between bg-white/70 backdrop-blur-md">

        <h1 className="text-2xl font-bold text-neutral-800">
          AI Itinerary
        </h1>

        <button className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-xl font-medium transition">
          Sign In
        </button>

      </div>

      {/* MAP */}
      <Map
        mapboxAccessToken="pk.eyJ1Ijoic2t5bGluZWdkZ29jIiwiYSI6ImNtNzRmaTk0YTAycmMycXB2NWZ1MjZpamcifQ.tzt5lPJ51rc4t_sEFGF0bQ"
        initialViewState={{
          longitude: -122.4194,
          latitude: 37.7749,
          zoom: 12,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/skylinegdgoc/cmotm993e002001sx2b969hh3"
      />

      {/* RESULTS */}
      <div className="absolute bottom-0 z-20 w-full flex justify-center">

        <div className="max-w-[1400px] w-full p-4 bg-white rounded-t-3xl shadow-2xl flex flex-col gap-3">

          {/* INPUT */}
          <div className="flex gap-3">

            <input
              className="flex-1 bg-neutral-100 p-2 rounded-xl outline-none border border-neutral-300"
              type="text"
              placeholder="Where do you plan on going?.."
            />

          </div>

          {/* PREFERENCES LABEL */}
          <p className="w-full text-left font-semibold text-neutral-700">
            Location Preferences
          </p>

          {/* CATEGORY BUTTONS */}
          <div className="w-full flex flex-wrap justify-start gap-4">

            <button className="bg-orange-100 text-orange-500 px-5 py-3 rounded-xl font-semibold hover:scale-105 transition">
              🌮 Restaurants
            </button>

            <button className="bg-blue-100 text-blue-500 px-5 py-3 rounded-xl font-semibold hover:scale-105 transition">
              🍿 Events
            </button>

            <button className="bg-purple-100 text-purple-500 px-5 py-3 rounded-xl font-semibold hover:scale-105 transition">
              🎋 Cultural
            </button>

            <button className="bg-green-100 text-green-600 px-5 py-3 rounded-xl font-semibold hover:scale-105 transition">
              🌲 Outdoors
            </button>

          </div>

          {/* TIME / OPTIONS ROW */}
          <div className="w-full flex flex-row flex-wrap gap-4">

            {/* START TIME */}
            <div className="flex flex-col">

              <p className="text-sm font-semibold text-neutral-700">
                Start Time
              </p>

              <input
                className="bg-neutral-100 p-2 rounded-xl border border-neutral-300"
                type="time"
              />

            </div>

            {/* END TIME */}
            <div className="flex flex-col">

              <p className="text-sm font-semibold text-neutral-700">
                End Time
              </p>

              <input
                className="bg-neutral-100 p-2 rounded-xl border border-neutral-300"
                type="time"
              />

            </div>

            {/* BUDGET */}
            <div className="flex flex-col">

              <p className="text-sm font-semibold text-neutral-700">
                Budget
              </p>

              <select className="bg-neutral-100 p-2 rounded-xl border border-neutral-300">
                <option>$</option>
                <option>$$</option>
                <option>$$$</option>
              </select>

            </div>

            {/* GROUP SIZE */}
            <div className="flex flex-col">

              <p className="text-sm font-semibold text-neutral-700">
                Group Size
              </p>

              <select className="bg-neutral-100 p-2 rounded-xl border border-neutral-300">
                <option>Solo</option>
                <option>2-4</option>
                <option>5+</option>
              </select>

            </div>

            {/* TRANSPORT */}
            <div className="flex flex-col">

              <p className="text-sm font-semibold text-neutral-700">
                Transport
              </p>

              <select className="bg-neutral-100 p-2 rounded-xl border border-neutral-300">
                <option>Walking</option>
                <option>Driving</option>
                <option>Transit</option>
                <option>Biking</option>
              </select>

            </div>

          </div>

          {/* GENERATE BUTTON */}
          <button
            onClick={() => setShowResults(true)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg transition shadow-lg"
          >
            ✨ Generate Itinerary
          </button>


          {/* RESULTS / ITINERARY SECTION */}
          {showResults && (

            <div className="w-full bg-neutral-100 rounded-3xl px-4 pt-4 pb-2 mt-1 flex flex-col gap-3">

              {/* TITLE */}
              <div className="flex items-center justify-between">

                <h2 className="text-2xl font-bold text-neutral-800">
                  Your Itinerary
                </h2>

                <p className="text-sm text-neutral-500">
                  Optimized route for your trip
                </p>
              </div>

              {/* TIMELINE */}
              <div className="w-full flex items-center gap-4">

                <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">
                  1
                </div>

                <div className="flex-1 h-1 bg-blue-300 rounded-full"></div>

                <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                  2
                </div>

                <div className="flex-1 h-1 bg-blue-300 rounded-full"></div>

                <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold">
                  3
                </div>

              </div>

              {/* ITINERARY CARDS */}
              <div className="flex flex-row gap-4 overflow-x-auto pb-0">

                {/* CARD 1 */}
                <div className="min-w-[280px] bg-white rounded-2xl shadow-md p-3 flex flex-col gap-2">

                  <div className="flex items-center justify-between">

                    <p className="text-sm font-semibold text-orange-500">
                      🌮 Restaurant
                    </p>

                    <p className="text-xs text-neutral-400">
                      Stop 1
                    </p>

                  </div>

                  <h3 className="text-xl font-bold text-neutral-800">
                    Nomu Skewers
                  </h3>

                  <p className="text-sm text-neutral-500">
                    11:45 AM - 12:30 PM
                  </p>

                  <img
                    src="https://images.unsplash.com/..."
                    className="w-full h-[100px] object-cover rounded-xl"
                  />

                  <p className="text-sm text-neutral-600">
                    Relaxed Japanese restaurant with skewers and sushi.
                  </p>

                </div>

                {/* CARD 2 */}
                <div className="min-w-[280px] bg-white rounded-2xl shadow-md p-3 flex flex-col gap-2">

                  <div className="flex items-center justify-between">

                    <p className="text-sm font-semibold text-green-600">
                      🌲 Outdoors
                    </p>

                    <p className="text-xs text-neutral-400">
                      Stop 2
                    </p>

                  </div>

                  <h3 className="text-xl font-bold text-neutral-800">
                    Salesforce Park
                  </h3>

                  <p className="text-sm text-neutral-500">
                    12:45 PM - 1:30 PM
                  </p>

                  <img
                    src="https://images.unsplash.com/..."
                    className="w-full h-[100px] object-cover rounded-xl"
                  />

                  <p className="text-sm text-neutral-600">
                    Rooftop urban park with gardens and skyline views.
                  </p>

                </div>

                {/* CARD 3 */}
                <div className="min-w-[280px] bg-white rounded-2xl shadow-md p-3 flex flex-col gap-2">

                  <div className="flex items-center justify-between">

                    <p className="text-sm font-semibold text-blue-500">
                      🍿 Event
                    </p>

                    <p className="text-xs text-neutral-400">
                      Stop 3
                    </p>

                  </div>

                  <h3 className="text-xl font-bold text-neutral-800">
                    SF Night Market
                  </h3>

                  <p className="text-sm text-neutral-500">
                    2:00 PM - 3:30 PM
                  </p>

                  <img
                    src="https://images.unsplash.com/..."
                    className="w-full h-[100px] object-cover rounded-xl"
                  />

                  <p className="text-sm text-neutral-600">
                    Outdoor food and music event featuring local vendors and live performances.
                  </p>

                </div>

              </div>

            </div>

          )}

        </div>

      </div>

    </main>
  )
}