import { Brain, MessageSquare, FileText, Settings } from 'lucide-react'
import { useUIStore } from '../stores'

export default function MobileTabs() {
  const mobileView = useUIStore((s) => s.mobileView)
  const setMobileView = useUIStore((s) => s.setMobileView)

  return (
    <div className="shrink-0 border-t border-slate-800 bg-slate-900/95 backdrop-blur px-1 py-2 flex items-center justify-around">
      <button
        onClick={() => setMobileView('chat')}
        className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-medium ${
          mobileView === 'chat' ? 'text-brand-400 bg-brand-500/10' : 'text-slate-500'
        }`}
      >
        <MessageSquare className="w-5 h-5" />
        <span>问答</span>
      </button>
      <button
        onClick={() => setMobileView('docs')}
        className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-medium ${
          mobileView === 'docs' ? 'text-brand-400 bg-brand-500/10' : 'text-slate-500'
        }`}
      >
        <FileText className="w-5 h-5" />
        <span>文档</span>
      </button>
      <button
        onClick={() => setMobileView('settings')}
        className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-medium ${
          mobileView === 'settings' ? 'text-brand-400 bg-brand-500/10' : 'text-slate-500'
        }`}
      >
        <Settings className="w-5 h-5" />
        <span>设置</span>
      </button>
      <button
        onClick={() => setMobileView('sidebar')}
        className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-medium ${
          mobileView === 'sidebar' ? 'text-brand-400 bg-brand-500/10' : 'text-slate-500'
        }`}
      >
        <Brain className="w-5 h-5" />
        <span>知识库</span>
      </button>
    </div>
  )
}
