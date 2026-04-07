
/**
 * Admin.tsx — Thin wrapper
 * All logic lives in components/admin/AdminShell.tsx
 * This file is the public export to maintain backwards compatibility
 * with the CommandMenu import.
 */
import React from 'react';
import { AdminShell } from './admin/AdminShell';
import { Place, Event, Category } from '../types';

interface AdminProps {
  onClose: () => void;
  places: Place[];
  events: Event[];
  categories?: Category[];
  onUpdate: () => void;
}

const Admin: React.FC<AdminProps> = (props) => <AdminShell {...props} />;

export default Admin;
