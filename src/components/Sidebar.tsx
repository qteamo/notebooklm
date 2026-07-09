import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, Trash2, PanelLeftClose, Globe, Brain } from 'lucide-react'
import { useKBStore, useUIStore } from '../stores'
import { useI18n } from '../i18n'

export default function Sidebar() {
  const navigate = useNavigate()
  const { t, locale, setLocale } = useI18n()
  const { knowledgeBases, activeKBId, loadKBs, createKB, deleteKB, setActiveKB } = useKBStore()
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const [newKBName, setNewKBName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { loadKBs() }, [loadKBs])

  const handleCreate = async () => {
    const name = newKBName.trim() || t('home.defaultKbName')
    const kb = await createKB(name)
    setNewKBName('')
    setCreating(false)
    setActiveKB(kb.id)
    setSidebarOpen(false)
    navigate(`/kb/${kb.id}`)
  }

  const toggleLang = () => setLocale(locale === 'zh' ? 'en' : 'zh')

  return (
    <div className="h-full flex flex-col bg-slate-900 border-r border-slate-800">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 text-brand-400" />
          </div>
          <span className="text-sm font-semibold text-slate-200 tracking-tight truncate">{t('app.name')}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleLang}
            title={locale === 'zh' ? 'Switch to English' : '切换到中文'}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors text-xs">
            {locale === 'zh' ? 'EN' : '中'}
          </button>
          <button onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors">
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KB list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {knowledgeBases.length === 0 ? (
          <div className="text-center py-12 px-4">
            <BookOpen className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-xs text-slate-500">{t('sidebar.noKB')}</p>
            <p className="text-xs text-slate-600 mt-1">{t('sidebar.createHint')}</p>
          </div>
        ) : (
          knowledgeBases.map((kb) => (
            <div
              key={kb.id}
              onClick={() => {
                setActiveKB(kb.id)
                setSidebarOpen(false)
                navigate(`/kb/${kb.id}`)
              }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all group cursor-pointer ${
                activeKBId === kb.id
                  ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{kb.name}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(t('sidebar.deleteConfirm', { name: kb.name }))) deleteKB(kb.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create */}
      <div className="p-3 border-t border-slate-800 shrink-0">
        {creating ? (
          <div className="space-y-2">
            <input
              type="text" value={newKBName} onChange={(e) => setNewKBName(e.target.value)}
              placeholder={t('sidebar.kbName')}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()} autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handleCreate} className="flex-1 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-lg transition-colors">{t('sidebar.create')}</button>
              <button onClick={() => setCreating(false)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded-lg transition-colors">{t('sidebar.cancel')}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreating(true)} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors border border-slate-700 hover:border-slate-600">
            <Plus className="w-4 h-4" />
            {t('sidebar.newKb')}
          </button>
        )}
      </div>
    </div>
  )
}
