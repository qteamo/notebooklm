import Dexie, { type EntityTable } from 'dexie';

// ── Domain Models ──────────────────────────────────

export interface KnowledgeBase {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Document {
  id: string;
  kbId: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'md';
  content: string;       // Extracted plain text
  rawData: ArrayBuffer;  // Original file bytes
  size: number;
  chunkCount: number;
  createdAt: number;
}

export interface Chunk {
  id: string;
  docId: string;
  kbId: string;
  index: number;
  text: string;
  embedding: number[] | null; // Computed or null until generated
}

export interface ChatSession {
  id: string;
  kbId: string;
  title: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources: string[]; // Chunk IDs that provided context
  createdAt: number;
}

export interface AppSettings {
  key: string;
  value: unknown;
}

// ── Database Schema ────────────────────────────────

export class AppDB extends Dexie {
  knowledgeBases!: EntityTable<KnowledgeBase, 'id'>;
  documents!: EntityTable<Document, 'id'>;
  chunks!: EntityTable<Chunk, 'id'>;
  chatSessions!: EntityTable<ChatSession, 'id'>;
  chatMessages!: EntityTable<ChatMessage, 'id'>;
  settings!: EntityTable<AppSettings, 'key'>;

  constructor() {
    super('notebooklm');

    this.version(1).stores({
      knowledgeBases: 'id, createdAt',
      documents: 'id, kbId, createdAt',
      chunks: 'id, docId, kbId',
      chatSessions: 'id, kbId, createdAt',
      chatMessages: 'id, sessionId, createdAt',
      settings: 'key',
    });
  }
}

export const db = new AppDB();
