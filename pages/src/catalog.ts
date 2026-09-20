export type AppCategory = 'everyday' | 'fine-arts';

export interface ExampleApp {
  slug: string;
  name: string;
  description: string;
  category: AppCategory;
}

export const apps: readonly ExampleApp[] = [
  { slug: 'books', name: 'Books', description: 'Local-first reading library with ISBN scanning and optional Open Library metadata enrichment.', category: 'everyday' },
  { slug: 'borrowed', name: 'Borrowed', description: 'Borrowing and lending records that can reference Inventory items.', category: 'everyday' },
  { slug: 'chores', name: 'Chores', description: 'Recurring household responsibilities with rotation and explicit shareable snapshots.', category: 'everyday' },
  { slug: 'church-documents', name: 'Church documents', description: 'Church document catalog with search, bookmarks, reading status, and official-text provenance.', category: 'everyday' },
  { slug: 'contractions', name: 'Contractions', description: 'Local-first contraction timing log.', category: 'everyday' },
  { slug: 'converter', name: 'Converter', description: 'Offline deterministic unit converter.', category: 'everyday' },
  { slug: 'documents', name: 'Documents', description: 'Household document catalog with managed-file import/export and source references.', category: 'everyday' },
  { slug: 'events', name: 'Events', description: 'Event organization workboard for invitees, commitments, setup, general work, and cleanup.', category: 'everyday' },
  { slug: 'gifts', name: 'Gifts', description: 'Private local-first gift tracker with explicit regift provenance.', category: 'everyday' },
  { slug: 'habits', name: 'Habits', description: 'Local-first habit tracker without streak or engagement mechanics.', category: 'everyday' },
  { slug: 'inventory', name: 'Inventory', description: 'Household inventory with barcode/QR scanning and explicit cross-app handoffs.', category: 'everyday' },
  { slug: 'maintenance', name: 'Maintenance', description: 'Maintenance history and due dates that can reference Inventory items.', category: 'everyday' },
  { slug: 'meetings', name: 'Meetings', description: 'Collaborative meeting scheduler with attendance polling, reminders, and route-aware carpool matching.', category: 'everyday' },
  { slug: 'money', name: 'Money', description: 'Local-first EUR ledger using integer cents.', category: 'everyday' },
  { slug: 'gregorian-chant', name: 'Gregorian chant', description: 'Gregorian chant library and practice foundation with GABC authority and explicit audio seams.', category: 'fine-arts' },
  { slug: 'music-practice', name: 'Music practice', description: 'Practice notebook with wall-clock timing and persistent native audio takes.', category: 'fine-arts' },
  { slug: 'sketchbook', name: 'Sketchbook', description: 'Local-first vector sketchbook with freehand drawing, brush controls, undo, and redo.', category: 'fine-arts' },
] as const;
