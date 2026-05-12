// This will be for the API to generate 
// the plan

// this is used for the locations

import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  const { destination, days, interests, budget } = await req.json();

  const prompt = `You are a travel expert. Create a ${days}-day itinerary for ${destination}.
Interests: ${interests}
Budget: ${budget}

Respond ONLY with valid JSON — no markdown, no backticks, no explanation.
Use this exact structure:
{
  "destination": "...",
  "days": [
    {
      "day": 1,
      "title": "...",
      "morning":   { "activity": "...", "location": "...", "tip": "..." },
      "afternoon": { "activity": "...", "location": "...", "tip": "..." },
      "evening":   { "activity": "...", "location": "...", "tip": "..." },
      "estimatedCost": "..."
    }
  ],
  "totalBudgetEstimate": "...",
  "packingTips": ["..."],
  "bestTimeToVisit": "..."
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text ?? '';


    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    const itinerary = JSON.parse(cleaned);
    return NextResponse.json({ itinerary });

  } catch (error) {
    const err = error as any;
    console.error('Full error:', JSON.stringify(error, null, 2));
    console.error('Error message:', err?.message);
    console.error('Error status:', err?.status);
    return NextResponse.json(
      { error: 'Failed to generate itinerary' },
      { status: 500 }
    );
  }
}