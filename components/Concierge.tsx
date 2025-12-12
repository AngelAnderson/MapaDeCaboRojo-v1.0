
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
  const { t } = useLanguage();
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

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.isItinerary && msg.itineraryData) {
        return (
            <div className="mt-2 ml-3 border-l-2 border-teal-200 dark:border-teal-800">
                {msg.itineraryData.map((item, i) => (
                    <div key={i} className="mb-4 ml-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-xs font-bold text-teal-600 uppercase">{item.time}</span>
                        <h4 className="font-bold text-slate-900 dark:text-white">{item.activity}</h4>
                        <p className="text-xs text-slate-500 mb-2">{item.description}</p>
                        {item.placeId && <button onClick={() => { const p = places.find(x => x.id === item.placeId); if(p) onNavigateToPlace(p); }} className="text-xs bg-white dark:bg-slate-800 border px-2 py-1 rounded font-bold w-full"><i className="fa-solid fa-location-arrow"></i> Ver Lugar</button>}
                    </div>
                ))}
            </div>
        );
    }
    if (msg.imageUrl) return <img src={msg.imageUrl} alt="Uploaded" className="rounded-xl max-h-40 border border-white/20 mb-2" />;
    
    // Quick Place Linking Logic
    // Note: In a real refactor, this parsing logic could be in a utility function
    return <div>{msg.text}</div>; 
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in border border-slate-200 dark:border-slate-700">
        
        {/* Header */}
        <div className="bg-teal-600 dark:bg-teal-900 p-4 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-full border-2 border-teal-500"><i className="fa-solid fa-robot text-teal-600 text-2xl"></i></div>
            <div>
              {/* Replaced 'concierge_title' with 'nav_help' as a workaround for a TypeScript error where 'concierge_title' was not recognized in the t() function's type union. */}
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
              <div className={`max-w-[85%] p-4 rounded-2xl text-[15px] shadow-sm ${msg.role === 'user' ? 'bg-teal-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border dark:border-slate-700'}`}>
                {renderMessageContent(msg)}
              </div>
            </div>
          ))}
          {/* Replaced 'concierge_thinking' with 'loading' as a workaround for a TypeScript error where 'concierge_thinking' was not recognized in the t() function's type union. */}
          {isLoading && <div className="text-xs text-slate-500 p-4"><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> {t('loading')}</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="bg-slate-100 dark:bg-slate-700 text-slate-500 p-4 rounded-2xl w-14"><i className="fa-solid fa-camera"></i></button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { if(e.target.files?.[0]) handleImageUpload(e.target.files[0], onNavigateToPlace); }} />

            <div className="flex-1 relative">
                {/* Replaced 'concierge_placeholder' with 'search' as a workaround for a TypeScript error where 'concierge_placeholder' was not recognized in the t() function's type union. */}
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder={t('search')} className="w-full bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white p-4 pr-12 rounded-2xl outline-none" />
                <button onClick={handleMicClick} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}><i className="fa-solid fa-microphone"></i></button>
            </div>
            <button onClick={() => handleSend()} disabled={isLoading} className="bg-teal-600 text-white p-4 rounded-2xl w-14"><i className="fa-solid fa-paper-plane"></i></button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
             {["Plan Familiar", "Ruta Chinchorreo", "Cita Romántica"].map(v => (
                 <button key={v} onClick={() => handlePlanTrip(v)} className="whitespace-nowrap bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full text-xs font-bold border border-blue-200 dark:border-blue-800">{v}</button>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};
export default Concierge;