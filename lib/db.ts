import Dexie, { type Table } from 'dexie';

export interface PDFFile {
  id?: number;
  name: string;
  blob: Blob;
  type: string;
  size: number;
  lastRead: number;
  currentPage: number;
}

export interface ChatMessage {
  id?: number;
  pdfId: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Highlight {
  id?: number;
  pdfId: number;
  pageIndex: number;
  content: string;
  color: string;
  highlightAreas: Array<{
    left: number;
    top: number;
    width: number;
    height: number;
    pageIndex: number;
  }>;
  createdAt: number;
}

export interface Bookmark {
  id?: number;
  pdfId: number;
  pageIndex: number;
  title: string;
  createdAt: number;
}

export interface Note {
  id?: number;
  pdfId: number;
  pageIndex: number;
  content: string;
  highlightId?: number;
  selectedText?: string;
  highlightAreas?: Array<{
    left: number;
    top: number;
    width: number;
    height: number;
    pageIndex: number;
  }>;
  createdAt: number;
  updatedAt: number;
}

export class NexusDB extends Dexie {
  pdfs!: Table<PDFFile>;
  messages!: Table<ChatMessage>;
  highlights!: Table<Highlight>;
  bookmarks!: Table<Bookmark>;
  notes!: Table<Note>;

  constructor() {
    super('NexusDB');
    this.version(2).stores({
      pdfs: '++id, name, lastRead',
      messages: '++id, pdfId, timestamp',
      highlights: '++id, pdfId, pageIndex, createdAt',
      bookmarks: '++id, pdfId, pageIndex, createdAt',
      notes: '++id, pdfId, pageIndex, highlightId, createdAt'
    });
  }
}

export const db = new NexusDB();

// Helper functions for notes
export async function getNotesByPdf(pdfId: number): Promise<Note[]> {
  return db.notes.where('pdfId').equals(pdfId).sortBy('createdAt');
}

export async function addNote(note: Omit<Note, 'id'>): Promise<number> {
  return db.notes.add(note);
}

export async function updateNote(id: number, content: string): Promise<void> {
  await db.notes.update(id, { content, updatedAt: Date.now() });
}

export async function deleteNote(id: number): Promise<void> {
  await db.notes.delete(id);
}

// Helper functions for bookmarks
export async function getBookmarksByPdf(pdfId: number): Promise<Bookmark[]> {
  return db.bookmarks.where('pdfId').equals(pdfId).sortBy('pageIndex');
}

export async function addBookmark(pdfId: number, pageIndex: number, title: string): Promise<number> {
  return db.bookmarks.add({ pdfId, pageIndex, title, createdAt: Date.now() });
}

export async function deleteBookmark(id: number): Promise<void> {
  await db.bookmarks.delete(id);
}

// Helper functions for highlights  
export async function getHighlightsByPdf(pdfId: number): Promise<Highlight[]> {
  return db.highlights.where('pdfId').equals(pdfId).sortBy('pageIndex');
}

export async function addHighlight(highlight: Omit<Highlight, 'id'>): Promise<number> {
  return db.highlights.add(highlight);
}

export async function deleteHighlight(id: number): Promise<void> {
  await db.highlights.delete(id);
}
