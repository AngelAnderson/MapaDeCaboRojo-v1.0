
import React, { useState, useRef, useEffect } from 'react';
import { createConciergeChat, identifyPlaceFromImage, generateTripItinerary } from '../services/geminiService';
import { ChatMessage, Place, Event, Coordinates, PlaceCategory, ItineraryItem } from '../types';
import Button from './Button';
import { useLanguage } from '../i18n/LanguageContext';
import { logUserActivity, createPlace } from '../services/supabase';

interface ConciergeProps {
  isOpen: boolean;
  onClose: () => void;
  places: Place[];
  events: Event[];
  onNavigateToPlace: (place: Place) => void;
}

const Concierge: React.FC<ConciergeProps> = ({ isOpen, onClose, places, events, onNavigateToPlace }) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [userLoc, setUserLoc] = useState<Coordinates | undefined>(undefined);
  
  // Visual Search State
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const chatRef = useRef<any>(null); 
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize: Get Location & Set Welcome Message
  useEffect(() => {
    if (isOpen) {
        if (messages.length === 0) {
            setMessages([{ role: 'model', text: '¡Wepa! Soy El Veci. ¿En qué te ayudo? Puedo planificar tu día o identificar lugares por foto.' }]);
        }
        
        // Try to get location silently to help AI
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.log("Loc denied or error", err),
                { enableHighAccuracy: false, timeout: 5000 }
            );
        }
    }
  }, [isOpen]);

  // Re-initialize AI when Data or Location changes
  useEffect(() => {
    if (places.length > 0 || events.length > 0) {
      try { 
          // Re-create chat with new context (location, new places)
          chatRef.current = createConciergeChat(places, events, userLoc); 
      } catch (e) { console.error("API Key missing"); }
    }
  }, [places, events, userLoc]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // --- SPECIAL FEATURES ---

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64String = (reader.result as string).split(',')[1];
          
          setMessages(prev => [...prev, { role: 'user', text: "📸 [Foto]", imageUrl: reader.result as string }]);
          setIsLoading(true);

          const result = await identifyPlaceFromImage(base64String, places);
          
          setMessages(prev => [...prev, { role: 'model', text: result.explanation }]);
          
          if (result.matchedPlaceId) {
             const place = places.find(p => p.id === result.matchedPlaceId);
             if (place) {
                 setTimeout(() => onNavigateToPlace(place), 1500);
             }
          }
          setIsLoading(false);
      };
      reader.readAsDataURL(file);
  };

  const handlePlanTrip = async (vibe: string) => {
      setMessages(prev => [...prev, { role: 'user', text: `Ármame un plan: ${vibe}` }]);
      setIsLoading(true);
      
      const itinerary = await generateTripItinerary(vibe, places);
      
      if (itinerary.length > 0) {
          setMessages(prev => [...prev, { 
              role: 'model', 
              text: '¡Aquí tienes el plan perfecto!', 
              isItinerary: true, 
              itineraryData: itinerary 
          }]);
      } else {
          setMessages(prev => [...prev, { role: 'model', text: 'Mala mía, no pude armar el plan. Intenta de nuevo.' }]);
      }
      setIsLoading(false);
  };

  // --- STANDARD CHAT ---

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || input;
    if (!textToSend.trim() || isLoading) return;
    
    setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setInput('');
    setIsLoading(true);
    
    // Log user activity
    logUserActivity('USER_CHAT', textToSend);

    try {
      if (chatRef.current) {
        const result = await chatRef.current.sendMessage({ message: textToSend });
        
        // --- HANDLE FUNCTION CALLS (Auto-Capture Missing Places & Updates) ---
        const calls = result.functionCalls;
        
        if (calls && calls.length > 0) {
             const newParts: any[] = [];
             
             for (const call of calls) {
                 if (call.name === 'reportMissingPlace') {
                     console.log("🤖 AI Auto-Reporting Missing Place:", call.args);
                     const { name, category, description, address } = call.args as any;

                     await createPlace({
                         name,
                         description,
                         category: (category as PlaceCategory) || PlaceCategory.SIGHTS,
                         address: address || 'Cabo Rojo, PR',
                         status: 'pending',
                         tags: ['AI-Auto-Capture', 'Pending Review'],
                         is_featured: false,
                         coords: { lat: 17.9620, lng: -67.1650 } 
                     });

                     newParts.push({
                         functionResponse: {
                             name: call.name,
                             id: call.id,
                             response: { success: true, message: "Place captured in database as Pending." }
                         }
                     });
                 }
                 
                 if (call.name === 'reportPlaceIssue') {
                     console.log("🤖 AI Reporting Issue:", call.args);
                     const { placeName, issueType, details } = call.args as any;
                     await logUserActivity('UPDATE_SUGGESTION', `${placeName} [${issueType}]: ${details}`);

                     newParts.push({
                         functionResponse: {
                             name: call.name,
                             id: call.id,
                             response: { success: true, message: "Issue logged for admin review." }
                         }
                     });
                 }
             }

             if (newParts.length > 0) {
                 const followUp = await chatRef.current.sendMessage({ message: newParts });
                 const finalResponse = followUp.text || "¡Oído! Lo anoté para que el equipo lo verifique.";
                 setMessages(prev => [...prev, { role: 'model', text: finalResponse }]);
             }
        } else {
             const responseText = result.text || "...";
             setMessages(prev => [...prev, { role: 'model', text: responseText }]);
        }
      }
    } catch (error) { 
        console.error(error);
        setMessages(prev => [...prev, { role: 'model', text: 'Mala mía, se me fue la señal. Intenta otra vez.' }]); 
    } finally { 
        setIsLoading(false); 
    }
  };

  const handleMicClick = () => {
    if (isListening) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-PR'; 
    recognition.continuous = false;
    recognition.onresult = (event: any) => setInput(event.results[0][0].transcript);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  // --- RENDERERS ---

  const renderItinerary = (items: ItineraryItem[]) => (
      <div className="mt-2 space-y-0 relative border-l-2 border-teal-200 dark:border-teal-800 ml-3">
          {items.map((item, i) => (
              <div key={i} className="mb-6 ml-6 relative">
                  <span className="absolute -left-[33px] top-0 w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900 border-2 border-teal-500 flex items-center justify-center z-10">
                      <i className={`fa-solid ${item.icon} text-teal-600 dark:text-teal-400 text-xs`}></i>
                  </span>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wide">{item.time}</span>
                      <h4 className="font-bold text-slate-900 dark:text-white">{item.activity}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{item.description}</p>
                      {item.placeId && (
                           <button 
                               onClick={() => {
                                   const p = places.find(x => x.id === item.placeId);
                                   if(p) onNavigateToPlace(p);
                               }}
                               className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-2 py-1 rounded-md font-bold text-slate-700 dark:text-slate-300 hover:text-teal-500 flex items-center gap-2 w-full justify-center"
                           >
                               <i className="fa-solid fa-location-arrow"></i> Ver Lugar
                           </button>
                      )}
                  </div>
              </div>
          ))}
      </div>
  );

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.isItinerary && msg.itineraryData) {
        return renderItinerary(msg.itineraryData);
    }
    
    if (msg.imageUrl) {
        return <img src={msg.imageUrl} alt="Uploaded" className="rounded-xl max-h-40 border border-white/20 mb-2" />;
    }

    const text = msg.text;
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
        if (!line.trim()) return <div key={lineIdx} className="h-2"></div>;

        const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
        const cleanLine = isBullet ? line.trim().substring(2) : line;

        const sortedPlaces = [...places].sort((a, b) => b.name.length - a.name.length);
        
        const parseSegment = (segment: string): React.ReactNode[] => {
            if (!segment) return [];
            let firstMatchIndex = -1;
            let matchedPlace: Place | null = null;
            let matchedName = "";

            for (const p of sortedPlaces) {
                const idx = segment.toLowerCase().indexOf(p.name.toLowerCase());
                if (idx !== -1) {
                    if (firstMatchIndex === -1 || idx < firstMatchIndex) {
                        firstMatchIndex = idx;
                        matchedPlace = p;
                        matchedName = segment.substring(idx, idx + p.name.length);
                    }
                }
            }

            if (matchedPlace && firstMatchIndex !== -1) {
                const before = segment.substring(0, firstMatchIndex);
                const after = segment.substring(firstMatchIndex + matchedName.length);
                return [
                    ...parseSegment(before),
                    <button 
                        key={`${matchedPlace.id}-${Math.random()}`}
                        onClick={() => onNavigateToPlace(matchedPlace!)}
                        className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 font-bold hover:bg-teal-200 dark:hover:bg-teal-800 transition-colors align-baseline text-[0.9em]"
                    >
                        <i className="fa-solid fa-location-dot text-[10px]"></i> {matchedName}
                    </button>,
                    ...parseSegment(after)
                ];
            }
            return [<span key={Math.random()} dangerouslySetInnerHTML={{ __html: segment.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />];
        };

        const contentNodes = parseSegment(cleanLine);

        if (isBullet) {
            return (
                <div key={lineIdx} className="flex gap-2 ml-2 mb-1">
                    <span className="text-teal-300 mt-1.5 text-[10px]"><i className="fa-solid fa-circle"></i></span>
                    <div className="flex-1">{contentNodes}</div>
                </div>
            );
        }
        return <div key={lineIdx} className="mb-1">{contentNodes}</div>;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in border border-slate-200 dark:border-slate-700 transition-colors">
        
        {/* Header */}
        <div className="bg-teal-600 dark:bg-teal-900 p-4 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white dark:bg-slate-800 p-2 rounded-full border-2 border-teal-500 dark:border-teal-700 shadow-sm relative">
                <i className="fa-solid fa-robot text-teal-600 dark:text-teal-400 text-2xl"></i>
            </div>
            <div>
                <h2 className="text-white font-black text-xl tracking-tight">{t('concierge_title')}</h2>
                <p className="text-teal-100 text-xs font-medium opacity-90">
                    {userLoc ? '📍 Ubicación detectada' : t('concierge_subtitle')}
                </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white bg-teal-700/50 hover:bg-teal-700 p-2 rounded-full w-10 h-10 transition-colors flex items-center justify-center"><i className="fa-solid fa-xmark text-lg"></i></button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 dark:bg-slate-900">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
              <div className={`max-w-[85%] p-4 rounded-2xl text-[15px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-teal-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none'}`}>
                {renderMessageContent(msg)}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-4 rounded-2xl rounded-bl-none text-sm shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    <span className="font-medium text-xs uppercase tracking-wide">{t('concierge_thinking')}</span>
                </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
          <div className="flex gap-2">
            
            {/* Camera Upload */}
            <button onClick={() => fileInputRef.current?.click()} className="bg-slate-100 dark:bg-slate-700 hover:bg-teal-100 dark:hover:bg-teal-900/30 text-slate-500 dark:text-slate-400 p-4 rounded-2xl w-14 flex items-center justify-center shadow-sm active:scale-95 transition-all">
                <i className="fa-solid fa-camera text-lg"></i>
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

            <div className="flex-1 relative">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder={t('concierge_placeholder')} className={`w-full bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white text-base p-4 pr-12 rounded-2xl border transition-all focus:outline-none placeholder:text-slate-400 ${isListening ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-600 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-800'}`} />
                <button onClick={handleMicClick} className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-teal-600 hover:bg-slate-200 dark:hover:bg-slate-600'}`}><i className={`fa-solid ${isListening ? 'fa-microphone-lines' : 'fa-microphone'} text-lg`}></i></button>
            </div>
            <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className="bg-teal-600 hover:bg-teal-700 text-white p-4 rounded-2xl w-14 flex items-center justify-center shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"><i className="fa-solid fa-paper-plane text-lg"></i></button>
          </div>
          
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            <button onClick={() => handlePlanTrip("Familiar y tranquilo")} className="whitespace-nowrap bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full text-xs font-bold border border-blue-200 dark:border-blue-800/30 transition-colors shadow-sm active:scale-95"><i className="fa-solid fa-child-reaching mr-1"></i> Plan Familiar</button>
            <button onClick={() => handlePlanTrip("Chinchorreo y fiesta")} className="whitespace-nowrap bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 text-purple-700 dark:text-purple-300 px-4 py-2 rounded-full text-xs font-bold border border-purple-200 dark:border-purple-800/30 transition-colors shadow-sm active:scale-95"><i className="fa-solid fa-beer-mug-empty mr-1"></i> Ruta Chinchorreo</button>
            <button onClick={() => handlePlanTrip("Romántico y atardecer")} className="whitespace-nowrap bg-pink-50 dark:bg-pink-900/30 hover:bg-pink-100 text-pink-700 dark:text-pink-300 px-4 py-2 rounded-full text-xs font-bold border border-pink-200 dark:border-pink-800/30 transition-colors shadow-sm active:scale-95"><i className="fa-solid fa-heart mr-1"></i> Cita Romántica</button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Concierge;
