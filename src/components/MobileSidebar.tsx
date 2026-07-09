import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Trash2, Plus, Brain } from 'lucide-react'
import { useKBStore } from '../stores'
import { useI18n } from '../i18n'

export default function MobileSidebar({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { knowledgeBases, activeKBId, loadKBs, createKB, deleteKB, setActiveKB } = useKBStore()
  const [newKBName, setNewKBName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { loadKBs() }, [loadKBs])

  const handleCreate = async () => {
    const name = newKBName.trim() || t('home.defaultKbName')
    const kb = await createKB(name)
    setNewKBName('')
    setCreating(false)
    setActiveKB(kb.id)
    onClose()
    navigate(`/kb/${kb.id}`)
  }

  return (
    <div className="h-full bg-slate-900 flex flex-col">
      {/* Header - no close button needed, tabs handle switching */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-500/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-brand-400" />
          </div>
          <span className="text-base font-bold text-slate-100">{t('app.name')}</span>
        </div>
      </div>

      {creating ? (
        <div className="px-5 py-4 border-b border-slate-800 space-y-3">
          <input type="text" value={newKBName} onChange={(e) => setNewKBName(e.target.value)}
            placeholder={t('sidebar.kbName')} autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-base text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50" />
          <div className="flex gap-3">
            <button onClick={handleCreate} className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl">{t('sidebar.create')}</button>
            <button onClick={() => setCreating(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm font-medium rounded-xl">{t('sidebar.cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating(true)}
          className="mx-5 mt-4 flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl border border-slate-700">
          <Plus className="w-4 h-4" />{t('sidebar.newKb')}
        </button>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {knowledgeBases.length === 0 && !creating ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <BookOpen className="w-10 h-10 text-slate-700 mb-3" />
            <p className="text-sm text-slate-500">{t('sidebar.noKB')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {knowledgeBases.map((kb) => (
              <div key={kb.id} onClick={() => { setActiveKB(kb.id); onClose(); navigate(`/kb/${kb.id}`) }}
                className={`w-full text-left px-4 py-3.5 rounded-xl transition-all cursor-pointer active:scale-[0.98] ${
                  activeKBId === kb.id ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <BookOpen className="w-4 h-4 shrink-0" />
                    <span className="text-sm truncate">{kb.name}</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(t('sidebar.deleteConfirm', { name: kb.name }))) deleteKB(kb.id) }}
                    className="p-2 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
