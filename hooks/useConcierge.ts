
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
        // --- STRICT DATE CONSTRUCTION ---
        // Create a date object relative to PR time
        const prFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Puerto_Rico',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            weekday: 'long',
            hour12: false
        });
        
        // This gives us parts we can trust relative to PR, regardless of user's local device time
        const parts = prFormatter.formatToParts(new Date());
        const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
        
        const year = getPart('year');
        const month = getPart('month');
        const day = getPart('day');
        const weekday = getPart('weekday');
        const hour = getPart('hour');
        const minute = getPart('minute');

        // Readable strings
        const humanDate = `${weekday}, ${day}/${month}/${year}`;
        const humanTime = `${hour}:${minute}`;
        const isoShort = `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;

        const contextInfo = {
            date: humanDate, 
            time: humanTime,
            iso_date: isoShort, 
            // Flat structure for easier AI parsing
            current_day: weekday,
            current_year: year,
            current_month: month,
            current_date_num: day,
            weather: weatherContext || 'Tropical'
        };

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
