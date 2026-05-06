"use client"

import MapView from "./components/MapView"

import Map from 'react-map-gl/mapbox';
// If using with mapbox-gl v1:
// import Map from 'react-map-gl/mapbox-legacy';
import 'mapbox-gl/dist/mapbox-gl.css';

const testPlaces = [
  { name: "Eiffel Tower", lat: 48.8584, lng: 2.2945 },
  { name: "Louvre Museum", lat: 48.8606, lng: 2.3376 },
  { name: "Notre Dame", lat: 48.8530, lng: 2.3499 },
]



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

        {/* the map */}
        {/* <MapView places={testPlaces} /> */}
        <Map
          mapboxAccessToken="pk.eyJ1Ijoic2t5bGluZWdkZ29jIiwiYSI6ImNtNzRmaTk0YTAycmMycXB2NWZ1MjZpamcifQ.tzt5lPJ51rc4t_sEFGF0bQ"
          initialViewState={{
            longitude: -122.4,
            latitude: 37.8,
            zoom: 14
          }}
          style={{width: '100%', height: '100%'}}
          mapStyle="mapbox://styles/skylinegdgoc/cmotm993e002001sx2b969hh3"
        />

        {/* main bottom interface */}
        <div className="z-10 absolute w-full bottom-0 flex flex-col items-center">

          {/* container with row of columns */}
          <div className="w-1/2 h-48 p-4 flex flex-row items-center justify-center gap-4 bg-white rounded-t-2xl">

              <div className="flex flex-col items-center justify-center gap-2">
                <div className="outline-2 outline-[#f1920e] bg-[#f1920e]/10 px-6 py-2 rounded-lg">
                  <p className="text-[#f1920e] font-semibold">🌮 Restaurants</p>
                </div>
                
              </div>

              {/* column */}
              <div className="flex flex-col items-center justify-center gap-2">
                <div>
                  <p className="font-bold">Describe your Journey</p>
                  <input className="bg-neutral-200" type="text"></input>
                </div>
              </div>
          </div>
        </div>

      </div>
    </main>
  )
}
