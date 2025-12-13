
import { useState, useEffect } from 'react';
import { Place, Event, ChatMessage, Coordinates } from '../types';
import { sendConciergeMessage, identifyPlaceFromImage, generateTripItinerary } from '../services/aiService'; 
import { logUserActivity } from '../services/supabase';
import { WeatherState } from './useWeather';

export const useConcierge = (places: Place[], events: Event[], userLoc?: Coordinates, weatherState?: WeatherState) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // --- OFFICIAL TIME FETCHER ---
  // Fetches atomic time for PR to prevent device-clock based hallucinations
  const getPuertoRicoTime = async () => {
      try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s Timeout
          
          // Free API: TimeAPI.io (No key required)
          const res = await fetch('https://timeapi.io/api/Time/current/zone?timeZone=America/Puerto_Rico', { 
              signal: controller.signal 
          });
          clearTimeout(timeoutId);
          
          if (!res.ok) throw new Error("TimeAPI failed");
          
          const data = await res.json();
          // TimeAPI returns: { year: 2025, month: 12, day: 13, dayOfWeek: "Saturday", time: "16:30", ... }
          return {
              year: data.year,
              month: data.month,
              day: data.day,
              weekday: data.dayOfWeek, 
              time: data.time, 
              iso: data.dateTime?.split('T')[0] || `${data.year}-${data.month}-${data.day}`,
              success: true
          };
      } catch (e) {
          console.warn("TimeAPI failed, falling back to system time", e);
          // Fallback: Local System Time converted to PR
          const now = new Date();
          const prString = now.toLocaleString("en-US", { timeZone: "America/Puerto_Rico" });
          const prDate = new Date(prString);
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          
          return {
              year: prDate.getFullYear(),
              month: prDate.getMonth() + 1,
              day: prDate.getDate(),
              weekday: days[prDate.getDay()],
              time: `${prDate.getHours()}:${String(prDate.getMinutes()).padStart(2, '0')}`,
              iso: prDate.toISOString().split('T')[0],
              success: false
          };
      }
  };

  // Handlers
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
        // 1. Get Absolute Truth Time
        const timeData = await getPuertoRicoTime();

        // 2. Format Dates for AI Context
        const humanDate = `${timeData.weekday}, ${timeData.day}/${timeData.month}/${timeData.year}`;
        
        // 3. Get Weather from Shared State (Centralized Source of Truth)
        const weatherString = weatherState 
            ? `${weatherState.temp}°F, ${weatherState.condition} (Advice: ${weatherState.advice})` 
            : 'Tropical (85°F)';
        
        const isRaining = weatherState?.condition?.toLowerCase().includes('rain') || weatherState?.condition?.toLowerCase().includes('lluvia') || false;

        const contextInfo = {
            date: humanDate, 
            time: timeData.time,
            iso: timeData.iso, 
            current_day: timeData.weekday,
            current_year: timeData.year,
            current_month: timeData.month,
            current_date_num: timeData.day,
            weather: weatherString,
            is_raining: isRaining
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
