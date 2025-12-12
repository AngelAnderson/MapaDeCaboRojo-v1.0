

import { useState, useRef, useEffect } from 'react';
import { Place, Event, ChatMessage, Coordinates, PlaceCategory } from '../types';
import { createConciergeChat, identifyPlaceFromImage, generateTripItinerary } from '../services/aiService'; // Updated import
import { logUserActivity, createPlace } from '../services/supabase';

export const useConcierge = (places: Place[], events: Event[], userLoc?: Coordinates) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [weatherContext, setWeatherContext] = useState<string>('');
  
  const chatRef = useRef<any>(null);
  const chatInitialized = useRef(false);

  // 1. Init Weather & Welcome
  useEffect(() => {
    if (messages.length === 0) {
        setMessages([{ role: 'model', text: '¡Wepa! Soy El Veci. ¿En qué te ayudo? Puedo planificar tu día o identificar lugares por foto.' }]);
    }
    const fetchWeather = async () => {
        try {
            const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=18.0262&longitude=-67.1725&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FPuerto_Rico');
            const data = await res.json();
            setWeatherContext(`${Math.round(data.current.temperature_2m)}°F`);
        } catch(e) { setWeatherContext("Soleado"); }
    };
    fetchWeather();
  }, []);

  // 2. Initialize Chat (ONCE)
  useEffect(() => {
    if (places.length > 0 && !chatInitialized.current) {
        const now = new Date();
        chatRef.current = createConciergeChat(places, events, userLoc, {
            date: now.toLocaleDateString('es-PR'),
            time: now.toLocaleTimeString('es-PR'),
            weather: weatherContext || 'Tropical'
        });
        chatInitialized.current = true;
    }
  }, [places.length, weatherContext]); // Reduced dependency churn

  // 3. Handlers
  const handleSend = async (overrideText?: string) => {
    const text = overrideText || input;
    if (!text.trim() || isLoading) return;

    if (!chatRef.current) {
        // Fallback if chat didn't init (e.g. offline)
        setMessages(prev => [...prev, { role: 'user', text }, { role: 'model', text: "Espérate un momento, estoy cargando..." }]);
        return;
    }

    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setIsLoading(true);
    logUserActivity('USER_CHAT', text);

    try {
        const result = await chatRef.current.sendMessage({ message: text });
        // Handle Function Calls (Auto-Capture)
        if (result.functionCalls?.length > 0) {
            const newParts: any[] = [];
            for (const call of result.functionCalls) {
                if (call.name === 'reportMissingPlace') {
                    const { name, category, description, address } = call.args as any;
                    await createPlace({ name, description, category: (category as PlaceCategory), address, status: 'pending', coords: {lat:18,lng:-67} });
                    newParts.push({ functionResponse: { name: call.name, id: call.id, response: { success: true } } });
                }
            }
            if (newParts.length > 0) {
                const followUp = await chatRef.current.sendMessage({ message: newParts });
                setMessages(prev => [...prev, { role: 'model', text: followUp.text }]);
            } else {
                setMessages(prev => [...prev, { role: 'model', text: result.text }]);
            }
        } else {
            setMessages(prev => [...prev, { role: 'model', text: result.text }]);
        }
    } catch (e) {
        setMessages(prev => [...prev, { role: 'model', text: "Mala mía, se me fue la señal." }]);
    } finally {
        setIsLoading(false);
    }
  };

  const handleImageUpload = async (file: File, onNavigate: (p: Place) => void) => {
      if (file.size > 5 * 1024 * 1024) {
          setMessages(prev => [...prev, { role: 'model', text: "Esa foto pesa mucho (Max 5MB). Trata con otra." }]);
          return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          setMessages(prev => [...prev, { role: 'user', text: "📸 [Foto]", imageUrl: reader.result as string }]);
          setIsLoading(true);
          const result = await identifyPlaceFromImage(base64, places);
          setMessages(prev => [...prev, { role: 'model', text: result.explanation }]);
          if (result.matchedPlaceId) {
             const p = places.find(x => x.id === result.matchedPlaceId);
             if (p) setTimeout(() => onNavigate(p), 1500);
          }
          setIsLoading(false);
      };
      reader.readAsDataURL(file);
  };

  const handlePlanTrip = async (vibe: string) => {
      setMessages(prev => [...prev, { role: 'user', text: `Ármame un plan: ${vibe}` }]);
      setIsLoading(true);
      const itinerary = await generateTripItinerary(vibe, places);
      setMessages(prev => [...prev, { role: 'model', text: '¡Aquí tienes el plan!', isItinerary: true, itineraryData: itinerary }]);
      setIsLoading(false);
  };

  return { messages, input, setInput, isLoading, isListening, handleSend, handleImageUpload, handlePlanTrip, setIsListening };
};