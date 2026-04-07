
import React from 'react';
import { Category } from '../../types';
import { Section, InputGroup, StyledInput } from './shared';

interface CategoriesManagerProps {
  categories: Category[];
  searchTerm: string;
  editingCategory: Partial<Category> | null;
  setEditingCategory: (c: Partial<Category> | null) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
}

export const CategoriesManager: React.FC<CategoriesManagerProps> = ({
  categories,
  searchTerm,
  editingCategory,
  setEditingCategory,
  onSave,
  onDelete,
  isSaving,
}) => {
  const searchLower = searchTerm.toLowerCase();
  const filtered = categories.filter(
    (c) =>
      !searchTerm ||
      c.label_es?.toLowerCase().includes(searchLower) ||
      c.label_en?.toLowerCase().includes(searchLower) ||
      c.id?.toLowerCase().includes(searchLower)
  );

  return (
    <>
      {!editingCategory && (
        <>
          <div className="p-2">
            <button
              onClick={() => setEditingCategory({ id: '', label_es: '', label_en: '', icon: 'tag', color: '#64748b' })}
              className="w-full p-4 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-blue-500 hover:text-blue-500 hover:bg-slate-800 transition-all font-bold text-sm flex flex-col items-center justify-center gap-1"
            >
              <i className="fa-solid fa-tag text-lg"></i>
              <span className="text-[10px]">Add Category</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            {filtered.map((c) => (
              <div
                key={c.id}
                onClick={() => setEditingCategory(c)}
                className="p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 bg-slate-800 border-slate-700 hover:bg-slate-700"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: c.color }}
                >
                  <i className={`fa-solid fa-${c.icon}`}></i>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-200">{c.label_es}</h4>
                  <p className="text-[10px] text-slate-500 font-mono">{c.id}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editingCategory && (
        <div className="p-4 md:p-8 max-w-3xl mx-auto pb-32 animate-slide-up">
          <div className="flex justify-between items-center mb-6 bg-slate-800 p-4 rounded-xl border border-slate-700">
            <span className="font-bold text-white text-lg">Category Editor</span>
            {editingCategory.id && (
              <button
                onClick={() => onDelete(editingCategory.id!)}
                className="text-red-500 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-900/20 transition-colors"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            )}
          </div>
          <Section title="Settings" icon="sliders">
            <InputGroup label="ID">
              <StyledInput
                value={editingCategory.id || ''}
                onChange={(e) => setEditingCategory({ ...editingCategory, id: e.target.value })}
              />
            </InputGroup>
            <InputGroup label="Label (ES)">
              <StyledInput
                value={editingCategory.label_es || ''}
                onChange={(e) => setEditingCategory({ ...editingCategory, label_es: e.target.value })}
              />
            </InputGroup>
            <InputGroup label="Label (EN)">
              <StyledInput
                value={editingCategory.label_en || ''}
                onChange={(e) => setEditingCategory({ ...editingCategory, label_en: e.target.value })}
              />
            </InputGroup>
            <InputGroup label="Icon (FA name)">
              <div className="flex gap-2">
                <StyledInput
                  value={editingCategory.icon || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                  placeholder="utensils"
                />
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white border border-slate-700"
                  style={{ backgroundColor: editingCategory.color || '#64748b' }}
                >
                  {editingCategory.icon && <i className={`fa-solid fa-${editingCategory.icon}`}></i>}
                </div>
              </div>
            </InputGroup>
            <InputGroup label="Color">
              <StyledInput
                type="color"
                value={editingCategory.color || '#64748b'}
                onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
              />
            </InputGroup>
          </Section>
        </div>
      )}
    </>
  );
};
