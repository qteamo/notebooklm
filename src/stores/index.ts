import { create } from 'zustand'
import { db, type KnowledgeBase } from '../db'

interface UIState {
  mobileView: 'chat' | 'docs' | 'settings' | 'sidebar'
  setMobileView: (view: 'chat' | 'docs' | 'settings' | 'sidebar') => void
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  mobileView: 'chat',
  setMobileView: (view) => {
    set({ mobileView: view, sidebarOpen: view === 'sidebar' });
  },
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => {
    set({ sidebarOpen: open });
    if (!open) set({ mobileView: 'chat' });
  },
}))

interface KBState {
  knowledgeBases: KnowledgeBase[]
  activeKBId: string | null
  loading: boolean
  loadKBs: () => Promise<void>
  createKB: (name: string) => Promise<KnowledgeBase>
  deleteKB: (id: string) => Promise<void>
  setActiveKB: (id: string | null) => void
}

export const useKBStore = create<KBState>((set, get) => ({
  knowledgeBases: [],
  activeKBId: null,
  loading: false,

  loadKBs: async () => {
    set({ loading: true })
    const kbs = await db.knowledgeBases.orderBy('createdAt').reverse().toArray()
    set({ knowledgeBases: kbs, loading: false })
  },

  createKB: async (name) => {
    const kb: KnowledgeBase = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await db.knowledgeBases.add(kb)
    await get().loadKBs()
    return kb
  },

  deleteKB: async (id) => {
    await db.knowledgeBases.delete(id)
    const sessions = await db.chatSessions.where('kbId').equals(id).toArray()
    for (const s of sessions) {
      await db.chatMessages.where('sessionId').equals(s.id).delete()
    }
    await db.chatSessions.where('kbId').equals(id).delete()
    await db.chunks.where('kbId').equals(id).delete()
    await db.documents.where('kbId').equals(id).delete()
    if (get().activeKBId === id) {
      set({ activeKBId: null })
    }
    await get().loadKBs()
  },

  setActiveKB: (id) => set({ activeKBId: id }),
}))
