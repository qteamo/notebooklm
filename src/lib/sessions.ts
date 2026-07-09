import { db, type ChatSession, type ChatMessage } from '../db';

export function uid(): string {
  return crypto.randomUUID();
}

// ── Session CRUD ──────────────────────────────────

export async function getKBSessions(kbId: string): Promise<ChatSession[]> {
  return db.chatSessions
    .where('kbId')
    .equals(kbId)
    .reverse()
    .sortBy('createdAt');
}

export async function createSession(kbId: string, title?: string): Promise<ChatSession> {
  const session: ChatSession = {
    id: uid(),
    kbId,
    title: title || '新对话',
    createdAt: Date.now(),
  };
  await db.chatSessions.add(session);
  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.chatMessages.where('sessionId').equals(sessionId).delete();
  await db.chatSessions.delete(sessionId);
}

export async function renameSession(sessionId: string, title: string): Promise<void> {
  await db.chatSessions.update(sessionId, { title });
}

// Auto-name: use first user message as title (truncated)
export async function autoNameSession(sessionId: string, firstMessage: string): Promise<void> {
  const title = firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '...' : '');
  await renameSession(sessionId, title);
}

// ── Message CRUD ──────────────────────────────────

export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  return db.chatMessages
    .where('sessionId')
    .equals(sessionId)
    .sortBy('createdAt');
}

export async function addMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<ChatMessage> {
  const msg: ChatMessage = {
    id: uid(),
    sessionId,
    role,
    content,
    sources: [],
    createdAt: Date.now(),
  };
  await db.chatMessages.add(msg);
  return msg;
}

export async function clearSessionMessages(sessionId: string): Promise<void> {
  await db.chatMessages.where('sessionId').equals(sessionId).delete();
}
