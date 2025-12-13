
import { Buffer } from 'buffer';

export default async function handler(req: any, res: any) {
  // Allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Handle query params from req.query (Standard Node/Vercel)
  const { action, query, place_id, reference } = req.query;
  
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: API key missing.' });
  }

  try {
    let googlePlacesUrl = '';

    if (action === 'autocomplete' && query) {
      googlePlacesUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query as string)}&components=country:pr&language=es&key=${apiKey}`;
    } 
    else if (action === 'details' && place_id) {
      // Added 'reviews' to fields
      googlePlacesUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id as string)}&fields=name,formatted_address,geometry,website,international_phone_number,opening_hours,price_level,rating,photos,editorial_summary,reviews&language=es&key=${apiKey}`;
    } 
    else if (action === 'photo' && reference) {
      // 1. Construct the Google Photo URL
      googlePlacesUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${reference}&key=${apiKey}`;
      
      // 2. Fetch the image
      const imageResponse = await fetch(googlePlacesUrl);
      
      if (!imageResponse.ok) {
          return res.status(imageResponse.status).send("Failed to fetch image from Google");
      }

      // 3. Forward the image headers and binary data
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await imageResponse.arrayBuffer();
      // Fix: Explicitly use imported Buffer to convert ArrayBuffer
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h
      return res.send(buffer);
    } 
    else {
      return res.status(400).json({ error: 'Invalid action or missing parameters' });
    }

    // Handle JSON endpoints (autocomplete, details)
    const googleApiResponse = await fetch(googlePlacesUrl);
    const googleApiData = await googleApiResponse.json();

    if (!googleApiResponse.ok) {
      return res.status(googleApiResponse.status).json({ error: googleApiData.error_message || 'Google Places API request failed' });
    }

    return res.status(200).json(googleApiData);

  } catch (error) {
    console.error('places-proxy encountered an error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
