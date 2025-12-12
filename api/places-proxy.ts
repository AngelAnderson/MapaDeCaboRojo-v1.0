
// api/places-proxy.ts
// This endpoint acts as a secure proxy to the Google Places API.
// IMPORTANT: NEVER expose your Google Places API Key directly on the frontend.

export default async function handler(request: Request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const query = url.searchParams.get('query');
  const placeId = url.searchParams.get('place_id');

  // Use the API key from environment variables (e.g., VITE_GOOGLE_PLACES_API_KEY from vite.config.ts)
  // On Vercel, this will be automatically injected as GOOGLE_PLACES_API_KEY.
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.VITE_GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY is not set');
    return new Response(JSON.stringify({ error: 'Server configuration error: API key missing.' }), { status: 500 });
  }

  try {
    let googlePlacesUrl = '';

    if (action === 'autocomplete' && query) {
      googlePlacesUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:pr&language=es&key=${apiKey}`;
    } else if (action === 'details' && placeId) {
      googlePlacesUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,formatted_address,geometry,website,international_phone_number,opening_hours,price_level,rating,photos&language=es&key=${apiKey}`;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action or missing parameters' }), { status: 400 });
    }

    const googleApiResponse = await fetch(googlePlacesUrl);
    const googleApiText = await googleApiResponse.text(); // Read as text first

    let googleApiData;
    try {
      googleApiData = JSON.parse(googleApiText); // Then try to parse
    } catch (parseError) {
      console.error('Failed to parse Google Places API response as JSON:', parseError, 'Raw text:', googleApiText.substring(0, 200));
      return new Response(JSON.stringify({ error: 'Google Places API returned non-JSON data or unexpected format.' }), { status: 500 });
    }

    if (!googleApiResponse.ok) {
      console.error('Google Places API Error:', googleApiData);
      return new Response(JSON.stringify({ error: googleApiData.error_message || 'Google Places API request failed' }), { status: googleApiResponse.status });
    }

    return new Response(JSON.stringify(googleApiData), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('places-proxy encountered an error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
