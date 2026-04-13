
import React from 'react';
import { Person } from '../../types';
import { Section, InputGroup, StyledInput, StyledTextArea } from './shared';

interface PeopleManagerProps {
  people: Person[];
  searchTerm: string;
  editingPerson: Partial<Person> | null;
  setEditingPerson: (p: Partial<Person> | null) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isUploading: boolean;
  isSaving: boolean;
}

export const PeopleManager: React.FC<PeopleManagerProps> = ({
  people,
  searchTerm,
  editingPerson,
  setEditingPerson,
  onSave,
  onDelete,
  onImageUpload,
  fileInputRef,
  isUploading,
  isSaving,
}) => {
  const searchLower = searchTerm.toLowerCase();
  const filtered = people.filter(
    (p) =>
      !searchTerm ||
      p.name?.toLowerCase().includes(searchLower) ||
      p.role?.toLowerCase().includes(searchLower) ||
      p.bio?.toLowerCase().includes(searchLower)
  );

  return (
    <>
      {!editingPerson && (
        <>
          <div className="p-2">
            <button
              onClick={() => setEditingPerson({ name: '', role: '', bio: '' })}
              className="w-full p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-emerald-500 hover:text-emerald-500 hover:bg-slate-800 transition-all font-bold text-sm flex flex-col items-center justify-center gap-1"
            >
              <i className="fa-solid fa-user-plus text-lg"></i>
              <span className="text-[10px]">Add Person</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => setEditingPerson(p)}
                className="p-4 rounded-xl border cursor-pointer transition-all flex gap-3 items-center bg-slate-800 border-slate-700 hover:bg-slate-700"
              >
                <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden shrink-0">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} className="w-full h-full object-cover" alt={p.name} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                      <i className="fa-solid fa-user"></i>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-slate-200 truncate">{p.name}</h4>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">{p.role}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editingPerson && (
        <div className="p-4 md:p-8 max-w-3xl mx-auto pb-32 animate-slide-up">
          <div className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
            <span className="font-bold text-white text-lg">Person Editor</span>
            {editingPerson.id && (
              <button
                onClick={() => onDelete(editingPerson.id!)}
                className="text-red-500 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-900/20 transition-colors"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            )}
          </div>
          <Section title="Basic Info" icon="user">
            <InputGroup label="Name">
              <StyledInput
                value={editingPerson.name || ''}
                onChange={(e) => setEditingPerson({ ...editingPerson, name: e.target.value })}
              />
            </InputGroup>
            <InputGroup label="Role">
              <StyledInput
                value={editingPerson.role || ''}
                onChange={(e) => setEditingPerson({ ...editingPerson, role: e.target.value })}
              />
            </InputGroup>
            <InputGroup label="Bio">
              <StyledTextArea
                value={editingPerson.bio || ''}
                onChange={(e) => setEditingPerson({ ...editingPerson, bio: e.target.value })}
              />
            </InputGroup>
            <InputGroup label="Image">
              <div className="flex gap-2">
                <StyledInput
                  value={editingPerson.imageUrl || ''}
                  onChange={(e) => setEditingPerson({ ...editingPerson, imageUrl: e.target.value })}
                  placeholder="https://..."
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-slate-700 text-white px-4 rounded-xl flex items-center justify-center min-w-[50px] hover:bg-slate-600 transition-colors"
                >
                  {isUploading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
                </button>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={onImageUpload} />
            </InputGroup>
            {editingPerson.imageUrl && (
              <img
                src={editingPerson.imageUrl}
                alt="Preview"
                className="w-24 h-24 object-cover rounded-full border border-slate-700"
              />
            )}
          </Section>
        </div>
      )}
    </>
  );
};
