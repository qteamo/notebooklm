import { Globe, Search, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { PRESET_MODELS } from '../../lib';
import type { ModelProvider, AskOptions } from '../../lib';

interface SettingsPanelProps {
  answerMode: AskOptions['mode'];
  setAnswerMode: (mode: AskOptions['mode']) => void;
  provider: ModelProvider;
  setProvider: (p: ModelProvider) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  model: string;
  setModel: (model: string) => void;
  kbEnabled: boolean;
  setKbEnabled: (enabled: boolean) => void;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (enabled: boolean) => void;
  localLoading?: boolean;
  onSave: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const API_PROVIDERS = (Object.keys(PRESET_MODELS) as ModelProvider[]).filter((p) => p !== 'local');

export default function SettingsPanel({
  answerMode,
  setAnswerMode,
  provider,
  setProvider,
  apiKey,
  setApiKey,
  apiUrl,
  setApiUrl,
  model,
  setModel,
  kbEnabled,
  setKbEnabled,
  webSearchEnabled,
  setWebSearchEnabled,
  onSave,
  t,
}: SettingsPanelProps) {
  return (
    <div className="space-y-4">
      {/* Answer Mode */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">{t('kbDetail.modeHint')}:</span>
        <div className="flex gap-1">
          {[
            { value: 'api' as const, label: 'API', icon: <Globe className="w-3 h-3" /> },
            {
              value: 'text-search' as const,
              label: '纯文本搜索',
              icon: <Search className="w-3 h-3" />,
            },
          ].map((m) => (
            <button
              key={m.value}
              onClick={() => setAnswerMode(m.value)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all ${
                answerMode === m.value
                  ? 'bg-slate-700 text-slate-200 border border-slate-600'
                  : 'bg-slate-800/50 text-slate-500 border border-slate-700 hover:border-slate-600'
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* API config */}
      {answerMode === 'api' && (
        <>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {API_PROVIDERS.map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  provider === p
                    ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600'
                }`}
              >
                {p === provider ? '● ' : ''}
                {t(`model.${p}` as string)}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('kbDetail.apiKeyPlaceholder')}
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
            />
            {provider === 'custom' && (
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder={t('kbDetail.apiUrlPlaceholder')}
                className="flex-[2] px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50"
              />
            )}
          </div>

          {(PRESET_MODELS[provider]?.models.length > 0 || provider === 'custom') && (
            <div className="flex gap-2 flex-wrap">
              {PRESET_MODELS[provider]?.models.map((m) => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                    model === m
                      ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                      : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {m}
                </button>
              ))}
              {provider === 'custom' && (
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={t('kbDetail.customModelPlaceholder')}
                  className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50 min-w-[140px]"
                />
              )}
            </div>
          )}

          <p className="text-xs text-slate-600">{t('kbDetail.apiKeyHint')}</p>
        </>
      )}

      {/* Text search */}
      {answerMode === 'text-search' && (
        <p className="text-xs text-slate-500">
          使用 BM25 关键词 + 全文搜索从文档中查找相关内容，完全离线，无需 API 或模型。
        </p>
      )}

      {/* KB Enable Toggle */}
      <div className="flex items-center justify-between py-1">
        <div>
          <span className="text-xs text-slate-400">启用知识库搜索</span>
          <p className="text-[10px] text-slate-600">关闭后直接调用模型回答，不搜索本地文档</p>
        </div>
        <Toggle checked={kbEnabled} onChange={setKbEnabled} />
      </div>

      {/* Web Search Toggle */}
      <div className="flex items-center justify-between py-1">
        <div className="flex items-center gap-2">
          {webSearchEnabled ? (
            <Wifi className="w-3 h-3 text-blue-400" />
          ) : (
            <WifiOff className="w-3 h-3 text-slate-600" />
          )}
          <div>
            <span className="text-xs text-slate-400">{t('kbDetail.webSearch')}</span>
            <p className="text-[10px] text-slate-600">{t('kbDetail.webSearchDesc')}</p>
          </div>
        </div>
        <Toggle checked={webSearchEnabled} onChange={setWebSearchEnabled} />
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={onSave}
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {t('kbDetail.save')}
        </button>
      </div>
    </div>
  );
}

/** Simple toggle switch component */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-colors relative ${
        checked ? 'bg-brand-500' : 'bg-slate-700'
      }`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
          checked ? 'translate-x-5.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
