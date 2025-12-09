
import React, { useState, useRef, useEffect } from 'react';
import { createConciergeChat } from '../services/geminiService';
import { ChatMessage, Place, Event, Coordinates } from '../types';
import Button from './Button';
import { useLanguage } from '../i18n/LanguageContext';
import { logUserActivity } from '../services/supabase';

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
  
  const chatRef = useRef<any>(null); 
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize: Get Location & Set Welcome Message
  useEffect(() => {
    if (isOpen) {
        if (messages.length === 0) {
            setMessages([{ role: 'model', text: '¡Wepa! Soy El Veci. ¿En qué te ayudo?' }]);
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
        const responseText = result.text || "...";
        setMessages(prev => [...prev, { role: 'model', text: responseText }]);
      }
    } catch (error) { 
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

  // --- MAGIC LINKS PARSER ---
  // Detects place names in text and wraps them in buttons
  const renderMessageContent = (text: string) => {
    // We want to preserve newlines first
    const lines = text.split('\n');
    
    return lines.map((line, lineIdx) => {
        // If empty line, return spacer
        if (!line.trim()) return <div key={lineIdx} className="h-2"></div>;

        // Check for bullet points
        const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
        const cleanLine = isBullet ? line.trim().substring(2) : line;

        // Magic Link Logic: Split line by place names
        // We create a complex regex to match any place name case-insensitively
        // To avoid performance issues, we filter places that might be in the text first? 
        // No, let's just do a greedy match for known places.
        
        const parts: React.ReactNode[] = [];
        let remainingText = cleanLine;

        // Sort places by name length (descending) to match longest names first (e.g. "Playa Sucia" before "Playa")
        const sortedPlaces = [...places].sort((a, b) => b.name.length - a.name.length);

        // This is a simplified parser. For a robust one, we'd need a tokenizing approach, 
        // but for this UI, we can just scan for specific names.
        
        // React does not easily allow recursive regex replacement for components. 
        // We will do a single pass finding the first match, then recursing on the rest.
        
        const parseSegment = (segment: string): React.ReactNode[] => {
            if (!segment) return [];
            
            // Find the first occurrence of ANY place name
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

            // No matches, just return text with bold formatting
            return [<span key={Math.random()} dangerouslySetInnerHTML={{ __html: segment.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />];
        };

        const contentNodes = parseSegment(cleanLine);

        if (isBullet) {
            return (
                <div key={lineIdx} className="flex gap-2 ml-2 mb-1">
                    <span className="text-teal-300 mt-1.5 text-[10px]"><i className="fa-solid fa-circle"></i></span>
                    <div className="flex-1">
                        {contentNodes}
                    </div>
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
                {userLoc && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-white" title="Location Active"></div>}
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
                {msg.role === 'model' ? renderMessageContent(msg.text) : msg.text}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-4 rounded-2xl rounded-bl-none text-sm shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                    <div className="flex gap-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="font-medium text-xs uppercase tracking-wide">{t('concierge_thinking')}</span>
                </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
          <div className="flex gap-2">
            <div className="flex-1 relative">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder={t('concierge_placeholder')} className={`w-full bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white text-base p-4 pr-12 rounded-2xl border transition-all focus:outline-none placeholder:text-slate-400 ${isListening ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-600 focus:border-teal-500 focus:bg-white dark:focus:bg-slate-800'}`} />
                <button onClick={handleMicClick} className={`absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-teal-600 hover:bg-slate-200 dark:hover:bg-slate-600'}`}><i className={`fa-solid ${isListening ? 'fa-microphone-lines' : 'fa-microphone'} text-lg`}></i></button>
            </div>
            <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className="bg-teal-600 hover:bg-teal-700 text-white p-4 rounded-2xl w-14 flex items-center justify-center shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"><i className="fa-solid fa-paper-plane text-lg"></i></button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            <button onClick={() => handleSend("¿Qué eventos hay hoy?")} className="whitespace-nowrap bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-4 py-2 rounded-full text-xs font-bold border border-purple-200 dark:border-purple-800/30 transition-colors shadow-sm active:scale-95"><i className="fa-solid fa-calendar-day mr-1"></i> Agenda Hoy</button>
            <button onClick={() => handleSend("Ármame una ruta de un día.")} className="whitespace-nowrap bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-4 py-2 rounded-full text-xs font-bold border border-orange-200 dark:border-orange-800/30 transition-colors shadow-sm active:scale-95"><i className="fa-solid fa-map-location-dot mr-1"></i> {t('concierge_help_route')}</button>
            <button onClick={() => handleSend("Recomiéndame algo de comer.")} className="whitespace-nowrap bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 px-4 py-2 rounded-full text-xs font-bold border border-red-200 dark:border-red-800/30 transition-colors shadow-sm active:scale-95"><i className="fa-solid fa-utensils mr-1"></i> {t('concierge_help_food')}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Concierge;
