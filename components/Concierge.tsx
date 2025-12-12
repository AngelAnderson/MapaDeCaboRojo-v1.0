
import React, { useRef, useEffect } from 'react';
import { ChatMessage, Place, Event, Coordinates } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { useConcierge } from '../hooks/useConcierge';

interface ConciergeProps {
  isOpen: boolean;
  onClose: () => void;
  places: Place[];
  events: Event[];
  onNavigateToPlace: (place: Place) => void;
  userLocation?: Coordinates;
}

const Concierge: React.FC<ConciergeProps> = ({ isOpen, onClose, places, events, onNavigateToPlace, userLocation }) => {
  const { t, language } = useLanguage();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use Custom Hook
  const { messages, input, setInput, isLoading, isListening, handleSend, handleImageUpload, handlePlanTrip, setIsListening } = useConcierge(places, events, userLocation);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleMicClick = () => {
    if (isListening) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-PR'; 
    recognition.onresult = (e: any) => setInput(e.results[0][0].transcript);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  };

  const renderSuggestedPlaces = (ids: string[]) => {
      const suggestions = places.filter(p => ids.includes(p.id));
      if (suggestions.length === 0) return null;

      return (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 pb-2 -ml-2 pl-2">
              {suggestions.map(place => (
                  <button 
                    key={place.id}
                    onClick={() => onNavigateToPlace(place)}
                    className="flex-shrink-0 w-32 bg-white dark:bg-slate-700/50 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-600 active:scale-95 transition-transform text-left group"
                  >
                      <div className="h-20 w-full overflow-hidden relative">
                          <img src={place.imageUrl} alt={place.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                          <span className="absolute bottom-1 left-2 text-[10px] text-white font-bold uppercase tracking-wide">{place.category}</span>
                      </div>
                      <div className="p-2">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate group-hover:text-teal-500 transition-colors">{place.name}</h4>
                          <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate">{place.status === 'closed' ? '🔴 Cerrado' : '🟢 Abierto'}</p>
                      </div>
                  </button>
              ))}
          </div>
      );
  };

  // Simple Markdown Parser for Chat
  const renderMarkdown = (text: string) => {
    // 1. Split by Bold (**text**)
    // 2. Then split by Links ([text](url)) inside non-bold parts
    return text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-black">{part.slice(2, -2)}</strong>;
        }
        return part.split(/(\[.*?\]\(.*?\))/g).map((subPart, j) => {
            const linkMatch = subPart.match(/^\[(.*?)\]\((.*?)\)$/);
            if (linkMatch) {
                return (
                    <a 
                        key={`${i}-${j}`} 
                        href={linkMatch[2]} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="underline font-bold opacity-90 hover:opacity-100 decoration-2"
                    >
                        {linkMatch[1]}
                    </a>
                );
            }
            return subPart;
        });
    });
  };

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.isItinerary) {
        return (
            <div>
                {/* Always show the text message if present */}
                <div className="mb-3 font-medium">{renderMarkdown(msg.text)}</div>
                
                {(!msg.itineraryData || msg.itineraryData.length === 0) ? (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs">
                        <i className="fa-solid fa-circle-exclamation mr-1"></i> No se pudo generar el itinerario. Intenta de nuevo.
                    </div>
                ) : (
                    <div className="ml-2 border-l-2 border-teal-200 dark:border-teal-800 space-y-4">
                        {msg.itineraryData.map((item, i) => (
                            <div key={i} className="ml-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                <span className="text-xs font-bold text-teal-600 uppercase flex items-center gap-2">
                                    <i className={`fa-solid ${item.icon || 'fa-clock'}`}></i>
                                    {item.time}
                                </span>
                                <h4 className="font-bold text-slate-900 dark:text-white mt-1">{item.activity}</h4>
                                <p className="text-xs text-slate-500 mb-2">{item.description}</p>
                                {item.placeId && <button onClick={() => { const p = places.find(x => x.id === item.placeId); if(p) onNavigateToPlace(p); }} className="text-xs bg-white dark:bg-slate-800 border dark:border-slate-600 px-3 py-1.5 rounded-lg font-bold w-full hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"><i className="fa-solid fa-location-arrow text-teal-500"></i> Ver Lugar</button>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }
    if (msg.imageUrl) return <img src={msg.imageUrl} alt="Uploaded" className="rounded-xl max-h-40 border border-white/20 mb-2" />;
    
    return (
        <div>
            <div className="whitespace-pre-line leading-relaxed">{renderMarkdown(msg.text)}</div>
            {msg.suggestedPlaceIds && msg.suggestedPlaceIds.length > 0 && renderSuggestedPlaces(msg.suggestedPlaceIds)}
        </div>
    ); 
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 z-[5000] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in border border-slate-200 dark:border-slate-700">
        
        {/* Header */}
        <div className="bg-teal-600 dark:bg-teal-900 p-4 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-full border-2 border-teal-500"><i className="fa-solid fa-robot text-teal-600 text-2xl"></i></div>
            <div>
              <h2 className="text-white font-black text-xl">{t('nav_help')}</h2>
              <p className="text-teal-100 text-xs font-medium">AI Assistant</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white bg-teal-700/50 hover:bg-teal-700 p-2 rounded-full w-10 h-10"><i className="fa-solid fa-xmark"></i></button>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 dark:bg-slate-900">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
              <div className={`max-w-[90%] p-4 rounded-2xl text-[15px] shadow-sm ${msg.role === 'user' ? 'bg-teal-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border dark:border-slate-700'}`}>
                {renderMessageContent(msg)}
              </div>
            </div>
          ))}
          {isLoading && (
              <div className="flex justify-start animate-slide-up">
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-bl-none border dark:border-slate-700 shadow-sm flex items-center gap-2 text-slate-500">
                      <i className="fa-solid fa-circle-notch fa-spin text-teal-500"></i>
                      <span className="text-xs font-bold">{t('loading')}</span>
                  </div>
              </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="bg-slate-100 dark:bg-slate-700 text-slate-500 p-4 rounded-2xl w-14 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"><i className="fa-solid fa-camera"></i></button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { if(e.target.files?.[0]) handleImageUpload(e.target.files[0], onNavigateToPlace); }} />

            <div className="flex-1 relative">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder={t('search')} className="w-full bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white p-4 pr-12 rounded-2xl outline-none border border-transparent focus:border-teal-500 transition-colors" />
                <button onClick={handleMicClick} className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}><i className="fa-solid fa-microphone"></i></button>
            </div>
            <button onClick={() => handleSend()} disabled={isLoading} className="bg-teal-600 text-white p-4 rounded-2xl w-14 hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/30 disabled:opacity-50 disabled:shadow-none"><i className="fa-solid fa-paper-plane"></i></button>
          </div>
          
          <div className="mt-3">
             <button 
                onClick={() => handleSend(language === 'es' ? "¿Qué lugares de comida están abiertos ahora?" : "What food places are open right now?")} 
                disabled={isLoading} 
                className="w-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-3 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
             >
                 <i className="fa-solid fa-utensils"></i>
                 {language === 'es' ? 'Comida Abierta' : 'Open for Food'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Concierge;
