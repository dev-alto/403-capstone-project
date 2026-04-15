"use client";

import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";

interface Place {
  name: string;
  lat: number;
  lng: number;
}

interface MapViewProps {
  places: Place[];
}

export default function MapView({ places }: MapViewProps) {
  const center =
    places.length > 0
      ? { lat: places[0].lat, lng: places[0].lng }
      : { lat: 0, lng: 0 };

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <div className="w-full h-96 rounded-xl shadow-lg overflow-hidden">
        <Map defaultCenter={center} defaultZoom={12} mapId="27313780480a6d0eeb8cc810">
          {places.map((place, index) => (
            <AdvancedMarker
              key={index}
              position={{ lat: place.lat, lng: place.lng }}
              title={place.name}
            >
              <Pin
                background="#4F46E5"
                borderColor="#3730A3"
                glyphColor="white"
                glyph={`${index + 1}`}
              />
            </AdvancedMarker>
          ))}
        </Map>
      </div>
    </APIProvider>
  );
}