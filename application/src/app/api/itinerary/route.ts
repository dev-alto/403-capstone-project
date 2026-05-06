// This will be for the API to generate 
// the plan

// this is used for the locations

import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});

export async function GET() {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Why is the sky blue?',
  });
  console.log(response.text);

  return Response.json({ message: 'this the api/itinerary/ endpoint' + response.text })
}