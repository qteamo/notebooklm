import { useNavigate } from 'react-router-dom';
import { Brain, Upload, MessageSquare, Zap, Shield, ExternalLink } from 'lucide-react';
import { useKBStore } from '../stores';
import { useI18n } from '../i18n';

export default function Home() {
  const navigate = useNavigate();
  const { createKB, setActiveKB } = useKBStore();
  const { t, tFeatures } = useI18n();

  const handleQuickStart = async () => {
    const kb = await createKB(t('home.defaultKbName'));
    setActiveKB(kb.id);
    navigate(`/kb/${kb.id}`);
  };

  const features = tFeatures();
  const icons = [
    <Upload className="w-5 h-5" key="upload" />,
    <MessageSquare className="w-5 h-5" key="chat" />,
    <Shield className="w-5 h-5" key="shield" />,
    <Zap className="w-5 h-5" key="zap" />,
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
        {/* Hero */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 mb-4 sm:mb-6">
            <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-brand-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-100 mb-3 sm:mb-4 tracking-tight">
            {t('app.name')}
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-slate-400 max-w-lg mx-auto mb-6 sm:mb-8">
            {t('app.tagline')}
            <br />
            <span className="text-slate-500 text-xs sm:text-sm">{t('app.tagline2')}</span>
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleQuickStart}
              className="px-5 sm:px-6 py-2.5 sm:py-3 bg-brand-500 hover:bg-brand-600 text-white text-sm sm:text-base font-medium rounded-xl transition-colors shadow-lg shadow-brand-500/20"
            >
              {t('home.quickStart')}
            </button>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 sm:px-6 py-2.5 sm:py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm sm:text-base font-medium rounded-xl border border-slate-700 transition-colors inline-flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">{t('home.github')}</span>
            </a>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-12 sm:mb-16">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="p-4 sm:p-5 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 shrink-0">
                  {icons[i]}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">
                    {f.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tech Stack */}
        <div className="text-center">
          <p className="text-xs text-slate-600 mb-3">{t('home.techStack')}</p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {['React 19', 'TypeScript', 'Dexie.js', 'Transformers.js', 'Tailwind CSS v4', 'PWA', 'Vite'].map((tech) => (
              <span
                key={tech}
                className="px-2.5 py-1 bg-slate-800/50 border border-slate-800 rounded-full text-[10px] sm:text-xs text-slate-500"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
