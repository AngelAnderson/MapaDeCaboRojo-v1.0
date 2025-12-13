
import { useState, useEffect } from 'react';
import { Place, Event, ChatMessage, Coordinates } from '../types';
import { sendConciergeMessage, identifyPlaceFromImage, generateTripItinerary } from '../services/aiService'; 
import { logUserActivity } from '../services/supabase';

export const useConcierge = (places: Place[], events: Event[], userLoc?: Coordinates) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [weatherContext, setWeatherContext] = useState<string>('');
  
  // 1. Init Weather
  useEffect(() => {
    const fetchWeather = async () => {
        try {
            // Quick timeout for weather to not block chat
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            
            const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=18.0262&longitude=-67.1725&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FPuerto_Rico', { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await res.json();
            setWeatherContext(`${Math.round(data.current.temperature_2m)}°F`);
        } catch(e) { setWeatherContext("Tropical"); }
    };
    fetchWeather();
  }, []);

  // 2. Handlers
  const handleSend = async (overrideText?: string) => {
    const text = overrideText || input;
    if (!text.trim() || isLoading) return;

    // Optimistically update UI
    const newHistory = [...messages, { role: 'user', text } as ChatMessage];
    setMessages(newHistory);
    setInput('');
    setIsLoading(true);
    logUserActivity('USER_CHAT', text);

    try {
        // --- ROBUST DATE CONSTRUCTION ---
        // We avoid Intl.DateTimeFormat for the "Truth" logic to prevent browser localization issues.
        // We want the literal time in Puerto Rico.
        const now = new Date();
        
        // 1. Get PR Time Components manually
        const prString = now.toLocaleString("en-US", { timeZone: "America/Puerto_Rico" });
        const prDate = new Date(prString);
        
        const year = prDate.getFullYear();
        const month = prDate.getMonth() + 1; // 1-12
        const day = prDate.getDate();
        const hours = prDate.getHours();
        const minutes = prDate.getMinutes();
        const weekday = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][prDate.getDay()];
        const monthName = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][prDate.getMonth()];

        // 2. Construct Strings
        // "2025-12-13"
        const isoShort = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        // "Sábado, 13 de Diciembre de 2025"
        const humanDate = `${weekday}, ${day} de ${monthName} de ${year}`;
        // "4:30 PM"
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const h12 = hours % 12 || 12;
        const mStr = String(minutes).padStart(2, '0');
        const humanTime = `${h12}:${mStr} ${ampm}`;

        const contextInfo = {
            date: humanDate, 
            time: humanTime,
            iso_date: isoShort, 
            date_components: { year, month, day, weekday }, // Explicit components for AI
            weather: weatherContext || 'Tropical'
        };

        // Pass the CURRENT 'places' and 'events' props directly to the service
        const response = await sendConciergeMessage(
            text, 
            newHistory, 
            places, 
            events, 
            userLoc, 
            contextInfo
        );
        
        setMessages(prev => [...prev, { 
            role: 'model', 
            text: response.text, 
            suggestedPlaceIds: response.suggestedPlaceIds 
        }]);
        
    } catch (e) {
        setMessages(prev => [...prev, { role: 'model', text: "Mala mía, se me fue la señal. Intenta otra vez. / My bad, lost signal. Try again." }]);
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
          
          setMessages(prev => [...prev, { role: 'model', text: result.explanation || "Interesante foto..." }]);
          if (result.matchedPlaceId) {
             const p = places.find(x => x.id === result.matchedPlaceId);
             if (p) {
                 setTimeout(() => onNavigate(p), 2000);
             }
          }
          setIsLoading(false);
      };
      reader.readAsDataURL(file);
  };

  const handlePlanTrip = async (vibe: string) => {
      setMessages(prev => [...prev, { role: 'user', text: `Ármame un plan: ${vibe}` }]);
      setIsLoading(true);
      
      try {
        const itinerary = await generateTripItinerary(vibe, places);
        if (itinerary && itinerary.length > 0) {
            setMessages(prev => [...prev, { role: 'model', text: '¡Aquí tienes el plan!', isItinerary: true, itineraryData: itinerary }]);
        } else {
            throw new Error("Empty itinerary");
        }
      } catch (e) {
        setMessages(prev => [...prev, { role: 'model', text: 'Ups, no pude armar el plan. Intenta de nuevo.' }]);
      } finally {
        setIsLoading(false);
      }
  };

  return { messages, input, setInput, isLoading, isListening, handleSend, handleImageUpload, handlePlanTrip, setIsListening };
};
