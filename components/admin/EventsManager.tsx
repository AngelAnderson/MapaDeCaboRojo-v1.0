
import React from 'react';
import { Event, EventCategory } from '../../types';
import { Section, InputGroup, StyledInput, StyledTextArea } from './shared';
import { useLanguage } from '../../i18n/LanguageContext';

interface EventsManagerProps {
  events: Event[];
  searchTerm: string;
  editingEvent: Partial<Event> | null;
  setEditingEvent: (e: Partial<Event> | null) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
}

export const EventsManager: React.FC<EventsManagerProps> = ({
  events,
  searchTerm,
  editingEvent,
  setEditingEvent,
  onSave,
  onDelete,
  isSaving,
}) => {
  const { t } = useLanguage();
  const searchLower = searchTerm.toLowerCase();
  const filtered = events.filter(
    (e) =>
      !searchTerm ||
      e.title?.toLowerCase().includes(searchLower) ||
      e.locationName?.toLowerCase().includes(searchLower) ||
      e.description?.toLowerCase().includes(searchLower)
  );

  return (
    <>
      {/* Sidebar list */}
      {!editingEvent && (
        <>
          <div className="p-2">
            <button
              onClick={() =>
                setEditingEvent({
                  title: '',
                  description: '',
                  category: EventCategory.MUSIC,
                  status: 'published',
                  isFeatured: false,
                  startTime: new Date().toISOString(),
                })
              }
              className="w-full p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-purple-500 hover:text-purple-500 hover:bg-slate-800 transition-all font-bold text-sm flex flex-col items-center justify-center gap-1"
            >
              <i className="fa-solid fa-calendar-plus text-lg"></i>
              <span className="text-[10px]">Add Event</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {filtered.map((e) => (
              <div
                key={e.id}
                onClick={() => setEditingEvent(e)}
                className="p-4 rounded-xl border cursor-pointer transition-all bg-slate-800 border-slate-700 hover:bg-slate-700"
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-bold text-sm text-slate-200 truncate">{e.title}</h4>
                  <span className="text-[10px] text-slate-500">{new Date(e.startTime).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <i className="fa-solid fa-location-dot"></i> {e.locationName}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Editor */}
      {editingEvent && (
        <div className="p-4 md:p-8 max-w-3xl mx-auto pb-32 animate-slide-up">
          <div className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
            <span className="font-bold text-white text-lg">Event Editor</span>
            {editingEvent.id && (
              <button
                onClick={() => onDelete(editingEvent.id!)}
                className="text-red-500 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-900/20 transition-colors"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            )}
          </div>
          <Section title="Event Details" icon="calendar">
            <InputGroup label="Title">
              <StyledInput
                value={editingEvent.title || ''}
                onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
              />
            </InputGroup>
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Start">
                <StyledInput
                  type="datetime-local"
                  value={editingEvent.startTime ? new Date(editingEvent.startTime).toISOString().slice(0, 16) : ''}
                  onChange={(e) =>
                    setEditingEvent({ ...editingEvent, startTime: new Date(e.target.value).toISOString() })
                  }
                />
              </InputGroup>
              <InputGroup label="End">
                <StyledInput
                  type="datetime-local"
                  value={editingEvent.endTime ? new Date(editingEvent.endTime).toISOString().slice(0, 16) : ''}
                  onChange={(e) =>
                    setEditingEvent({ ...editingEvent, endTime: new Date(e.target.value).toISOString() })
                  }
                />
              </InputGroup>
            </div>
            <InputGroup label="Location">
              <StyledInput
                value={editingEvent.locationName || ''}
                onChange={(e) => setEditingEvent({ ...editingEvent, locationName: e.target.value })}
              />
            </InputGroup>
            <InputGroup label="Description">
              <StyledTextArea
                value={editingEvent.description || ''}
                onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
              />
            </InputGroup>
          </Section>
        </div>
      )}
    </>
  );
};
