import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Upload,
  Trash2,
  Loader2,
  Send,
  Sparkles,
  Database,
  ArrowLeft,
  PanelLeft,
  StopCircle,
  Zap,
  Settings,
  Brain,
  Globe,
  Plus,
  Search,
  Wifi,
  WifiOff,
  FileText,
  X,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { useKBStore, useUIStore } from '../stores';
import { useI18n } from '../i18n';
import { db, type Document, type Chunk } from '../db';
import {
  processDocument,
  getKBDocuments,
  deleteDocument,
  getKBChunks,
  embedChunks,
  semanticSearch,
  hybridSearch,
  getEmbeddingStatus,
  askStream,
  enqueueAutoIndex,
  webSearch,
  formatWebSearchContext,
  getKBSessions,
  createSession,
  deleteSession,
  getSessionMessages,
  addMessage,
  autoNameSession,
  PRESET_MODELS,

} from '../lib';
import MobileSidebar from '../components/MobileSidebar';
import type { ModelProvider, AskOptions } from '../lib';

// ── Sub-components ────────────────────────────────

function UploadZone({
  onUpload, disabled, dropText, formatsText,
}: {
  onUpload: (files: FileList) => void;
  disabled?: boolean;
  dropText: string;
  formatsText: string;
}) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (disabled) return;
    onUpload(e.dataTransfer.files);
  }, [onUpload, disabled]);

  const handleClick = useCallback(() => {
    // Use ref directly for Android WebView compatibility
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (e.target.files && e.target.files.length > 0) {
        onUpload(e.target.files);
      }
    } catch (err) {
      console.error('File upload error:', err);
    }
    // Reset so same file can be picked again
    e.target.value = '';
  }, [onUpload]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
        dragging ? 'border-brand-400 bg-brand-500/5 drop-active'
          : 'border-slate-700 hover:border-slate-600 bg-slate-900/30'
      } ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
      onClick={handleClick}
    >
      <input ref={fileInputRef} id="file-input" type="file" className="hidden" multiple
        accept=".pdf,.docx,.md,.txt"
        onChange={handleFileChange}
        disabled={disabled} />
      <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
      <p className="text-sm text-slate-400 mb-1">{dropText}</p>
      <p className="text-xs text-slate-600">{formatsText}</p>
    </div>
  );
}

function ChatBubble({ message, isStreaming, reasoning }: { message: { role: string; content: string; reasoning?: string }; isStreaming?: boolean; reasoning?: string }) {
  const isUser = message.role === 'user';
  const [reasoningOpen, setReasoningOpen] = useState(true);
  const displayReasoning = reasoning || message.reasoning;

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-brand-400" />
        </div>
      )}
      <div className={`max-w-[80%] ${isUser ? '' : 'space-y-2'}`}>
        {/* Reasoning bubble */}
        {!isUser && displayReasoning && (
          <div className="border border-amber-500/20 rounded-xl overflow-hidden">
            <button
              onClick={() => setReasoningOpen(!reasoningOpen)}
              className="w-full flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-xs text-amber-400 hover:bg-amber-500/15 transition-colors"
            >
              <Brain className="w-3 h-3" />
              <span>思考过程</span>
              <span className="ml-auto text-[10px] text-amber-500/60">{reasoningOpen ? '收起' : '展开'}</span>
            </button>
            {reasoningOpen && (
              <div className="px-3 py-2 text-xs text-amber-300/70 whitespace-pre-wrap leading-relaxed bg-amber-500/5 max-h-48 overflow-y-auto">
                {displayReasoning}
              </div>
            )}
          </div>
        )}
        {/* Main content */}
        <div className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap break-words ${
          isUser ? 'bg-brand-500/20 text-slate-200 rounded-br-md' : 'bg-slate-800/80 text-slate-300 rounded-bl-md'
        }`}>
          {message.content}
          {isStreaming && <span className="inline-block w-2 h-5 bg-brand-400 animate-pulse ml-0.5 align-text-bottom rounded-sm" />}
        </div>
      </div>
    </div>
  );
}

// ── Answer Mode Badge ─────────────────────────────

function AnswerModeBadge({ mode, t }: { mode: 'api' | 'local' | 'text-search'; t: (key: string) => string }) {
  const configs = {
    'api': { icon: <Globe className="w-2.5 h-2.5" />, color: 'bg-green-500/15 text-green-400 border-green-500/20', label: 'API' },
    'text-search': { icon: <Search className="w-2.5 h-2.5" />, color: 'bg-amber-500/15 text-amber-400 border-amber-500/20', label: 'TXT' },
  };
  const c = configs[mode];
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium ${c.color}`}>
      {c.icon}
      <span>{c.label}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────

export default function KBDetail() {
  const { kbId } = useParams<{ kbId: string }>();
  const navigate = useNavigate();
  const { t, locale, setLocale } = useI18n();
  const { knowledgeBases, deleteKB, setActiveKB } = useKBStore();
  const mobileView = useUIStore((s) => s.mobileView);
  const setMobileView = useUIStore((s) => s.setMobileView);
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();
  const kb = knowledgeBases.find((k) => k.id === kbId);

  // Stop generation
  const handleStop = () => {
    abortRef.current?.abort();
  };

  // Data
  const [docs, setDocs] = useState<Document[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [embeddingProgress, setEmbeddingProgress] = useState<{ done: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Chat
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [chatting, setChatting] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [provider, setProvider] = useState<ModelProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [model, setModel] = useState('');
  const [answerMode, setAnswerMode] = useState<AskOptions['mode']>('text-search');
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [kbEnabled, setKbEnabled] = useState(true);
  const [sessions, setSessions] = useState<{ id: string; title: string; createdAt: number }[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    if (!kbId) return;
    setLoading(true);
    try {
      const [loadedDocs, loadedChunks] = await Promise.all([getKBDocuments(kbId), getKBChunks(kbId)]);
      setDocs(loadedDocs);
      setChunks(loadedChunks);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [kbId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Per-provider settings cache for fast switching
  const providerCacheRef = useRef<Record<string, { key: string; url: string; model: string }>>({});

  // Load saved settings — per-provider
  useEffect(() => {
    (async () => {
      const savedProvider = (await db.settings.get('api_provider'))?.value as ModelProvider | undefined;
      const currentProvider = savedProvider || 'openai';
      setProvider(currentProvider);

      // Migrate old universal key to per-provider keys
      const oldKey = (await db.settings.get('api_key'))?.value as string | undefined;
      const oldUrl = (await db.settings.get('api_url'))?.value as string | undefined;
      const oldModel = (await db.settings.get('api_model'))?.value as string | undefined;
      if (oldKey) {
        const savedProvider = (await db.settings.get('api_provider'))?.value as ModelProvider | undefined;
        const targetProvider = savedProvider || 'openai';
        await db.settings.put({ key: `api_key_${targetProvider}`, value: oldKey });
        if (oldUrl) await db.settings.put({ key: `api_url_${targetProvider}`, value: oldUrl });
        if (oldModel) await db.settings.put({ key: `api_model_${targetProvider}`, value: oldModel });
        // Clear old keys
        await db.settings.delete('api_key');
        await db.settings.delete('api_url');
        await db.settings.delete('api_model');
      }

      const loadProviderSettings = async (p: ModelProvider) => ({
        key: ((await db.settings.get(`api_key_${p}`))?.value as string) || '',
        url: ((await db.settings.get(`api_url_${p}`))?.value as string) || PRESET_MODELS[p].url,
        model: ((await db.settings.get(`api_model_${p}`))?.value as string) || PRESET_MODELS[p].models[0] || '',
      });

      const currentSettings = await loadProviderSettings(currentProvider);
      setApiKey(currentSettings.key);
      setApiUrl(currentSettings.url);
      setModel(currentSettings.model);

      // Cache all providers
      for (const p of Object.keys(PRESET_MODELS) as ModelProvider[]) {
        providerCacheRef.current[p] = p === currentProvider ? currentSettings : await loadProviderSettings(p);
      }

      const savedMode = (await db.settings.get('answer_mode'))?.value as AskOptions['mode'] | undefined;
      if (savedMode) {
        // Block local LLM mode — downgrade to text-search
        setAnswerMode(savedMode === 'local' ? 'text-search' : savedMode);
      }

      const savedKbEnabled = (await db.settings.get('kb_enabled'))?.value;
      if (savedKbEnabled !== undefined && savedKbEnabled !== null) {
        setKbEnabled(savedKbEnabled as boolean);
      }
    })();
  }, []);

  // When provider changes, swap in that provider's saved config
  useEffect(() => {
    const cached = providerCacheRef.current[provider];
    if (cached) {
      setApiKey(cached.key);
      setApiUrl(cached.url);
      setModel(cached.model || PRESET_MODELS[provider].models[0] || '');
    } else {
      const preset = PRESET_MODELS[provider];
      setApiKey('');
      setApiUrl(preset.url);
      setModel(preset.models[0] || '');
    }
  }, [provider]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, streamingContent, streamingReasoning]);

  // Upload
  const handleUpload = async (files: FileList) => {
    if (!kbId) return;
    setProcessing(true);
    try {
      for (const file of Array.from(files)) {
        await processDocument(kbId, file, () => {
          // Auto-index: start generating embeddings in background
          enqueueAutoIndex(kbId);
        });
      }
      // If not using progress callback (old API), trigger anyway
      enqueueAutoIndex(kbId);
      await loadData();
    } catch (err) {
      alert(`${t('kbDetail.uploadFailed')}: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally { setProcessing(false); }
  };

  // Delete doc
  const handleDelete = async (docId: string) => {
    try {
      if (!confirm(t('kbDetail.deleteDoc'))) return;
      await deleteDocument(docId);
      await loadData();
    } catch (err) {
      console.error('Delete failed:', err);
      alert(`删除失败: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  // Embeddings
  const handleGenerateEmbeddings = async () => {
    const unembedded = chunks.filter((c) => c.embedding === null);
    if (unembedded.length === 0) { alert(t('embed.alreadyIndexed')); return; }
    setEmbeddingProgress({ done: 0, total: unembedded.length });
    try {
      await embedChunks(unembedded, (done, total) => setEmbeddingProgress({ done, total }));
      await loadData();
      alert(t('embed.indexingComplete'));
    } catch { alert(t('embed.indexingFailed')); }
    finally { setEmbeddingProgress(null); }
  };

  const searchLockRef = useRef(false);
  const [webSources, setWebSources] = useState<{ title: string; url: string }[]>([]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    if (!kbId) return;
    const list = await getKBSessions(kbId);
    setSessions(list);
    return list;
  }, [kbId]);

  useEffect(() => {
    // Reset state when KB changes
    setActiveSessionId(null);
    setMessages([]);

    loadSessions().then((list) => {
      if (list && list.length > 0) {
        // Always pick the first session of this KB
        setActiveSessionId(list[0].id);
      } else if (list && list.length === 0 && kbId) {
        // Auto-create if none exist
        createSession(kbId).then((s) => {
          setSessions([s]);
          setActiveSessionId(s.id);
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbId]);

  // Load messages for active session
  useEffect(() => {
    if (!activeSessionId) return;
    (async () => {
      const msgs = await getSessionMessages(activeSessionId);
      setMessages(msgs.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
    })();
  }, [activeSessionId]);

  // Send message
  const handleSend = () => {
    const query = input.trim();
    if (!query || !kbId || chatting || searchLockRef.current) return;
    setInput('');
    searchLockRef.current = true;
    const updatedMessages = [...messages, { role: 'user', content: query }];
    setMessages(updatedMessages);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
    // Save user msg + ensure session exists
    (async () => {
      let sid = activeSessionId;
      if (!sid) {
        const s = await createSession(kbId);
        sid = s.id;
        setSessions(prev => [s, ...prev]);
        setActiveSessionId(s.id);
      }
      await addMessage(sid, 'user', query);
      if (messages.length === 0) await autoNameSession(sid, query);
      setTimeout(() => executeSearch(updatedMessages, sid), 10);
    })();
  };

  const executeSearch = async (currentMessages: { role: string; content: string }[], sessionId: string) => {
    const query = currentMessages[currentMessages.length - 1].content;
    const controller = new AbortController();
    abortRef.current = controller;

    setChatting(true);
    setStreamingContent('');
    setStreamingReasoning('');
    setWebSources([]);
    const history = currentMessages.slice(-6);

    try {
      const searchResults = kbEnabled
        ? await hybridSearch(kbId!, query, chunks, semanticSearch, 10)
        : [];

      if (controller.signal.aborted) return;

      const mode = answerMode || 'text-search';

      let webContext: string | undefined;
      let webList: { title: string; url: string }[] = [];
      if (webSearchEnabled) {
        console.debug('[WebSearch] searching:', query);
        const webResults = await webSearch(query, 5);
        console.debug('[WebSearch] results:', webResults.length, webResults.map(r => r.title));
        webContext = formatWebSearchContext(webResults, locale);
        webList = webResults.map(r => ({ title: r.title, url: r.url }));
      }

      if (controller.signal.aborted) return;

      const stream = askStream(
        { query, context: searchResults, chatHistory: history, mode, provider,
          apiKey: apiKey || undefined, apiUrl: apiUrl || undefined, model: model || undefined,
          webSearch: webSearchEnabled, webSearchContext: webContext },
        locale,
        controller.signal,
      );

      let fullContent = '';
      let reasoningContent = '';
      let inReasoning = false;

      for await (const event of stream) {
        if (controller.signal.aborted) break;

        if (event.type === 'reasoning_start') {
          inReasoning = true; reasoningContent = ''; setStreamingReasoning('');
          continue;
        }
        if (event.type === 'reasoning_end') { inReasoning = false; continue; }

        if (inReasoning) {
          reasoningContent += event.text;
          setStreamingReasoning(reasoningContent);
        } else {
          fullContent += event.text;
          setStreamingContent(fullContent);
        }
      }

      if (controller.signal.aborted) {
        if (fullContent) {
          await addMessage(sessionId, 'assistant', fullContent);
          setMessages((prev) => [...prev, { role: 'assistant', content: fullContent, reasoning: reasoningContent || undefined }]);
        }
        return;
      }

      const replyContent = fullContent || t('kbDetail.emptyResponse');
      await addMessage(sessionId, 'assistant', replyContent);
      setMessages((prev) => [...prev, { role: 'assistant', content: replyContent, reasoning: reasoningContent || undefined }]);

      if (webList.length > 0 && searchResults.length === 0) {
        setWebSources(webList);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const errContent = `${t('kbDetail.error')} ${err instanceof Error ? err.message : 'Unknown'}`;
      await addMessage(sessionId, 'assistant', errContent);
      setMessages((prev) => [...prev, { role: 'assistant', content: errContent }]);
    } finally {
      setChatting(false);
      setStreamingContent('');
      setStreamingReasoning('');
      abortRef.current = null;
      searchLockRef.current = false;
    }
  };

  const handleNewSession = async () => {
    if (!kbId) return;
    const s = await createSession(kbId);
    setSessions(prev => [s, ...prev]);
    setActiveSessionId(s.id);
    setMessages([]);
  };

  const handleSwitchSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm(t('kbDetail.deleteSession'))) return;
    await deleteSession(sessionId);
    const updated = sessions.filter(s => s.id !== sessionId);
    setSessions(updated);
    if (activeSessionId === sessionId) {
      if (updated.length > 0) {
        setActiveSessionId(updated[0].id);
      } else {
        setActiveSessionId(null);
        setMessages([]);
      }
    }
  };

  // Save settings
  const handleSaveSettings = async () => {
    // Auto-select answer mode before saving
    let effectiveMode = answerMode;
    if (apiKey.trim()) {
      effectiveMode = 'api';
    } else {
      effectiveMode = 'text-search';
    }
    // Save per-provider
    await Promise.all([
      db.settings.put({ key: 'api_provider', value: provider }),
      db.settings.put({ key: `api_key_${provider}`, value: apiKey }),
      db.settings.put({ key: `api_url_${provider}`, value: apiUrl }),
      db.settings.put({ key: `api_model_${provider}`, value: model }),
      db.settings.put({ key: 'answer_mode', value: effectiveMode }),
      db.settings.put({ key: 'kb_enabled', value: kbEnabled }),
    ]);

    // Update cache
    providerCacheRef.current[provider] = { key: apiKey, url: apiUrl, model };
    setAnswerMode(effectiveMode);
    setShowSettings(false);
  };

  // Derive current effective answer mode
  const effectiveMode = answerMode;

  const embedStatus = getEmbeddingStatus(chunks);
  const typeIcons: Record<string, string> = { pdf: '📕', docx: '📘', md: '📝', txt: '📄' };
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  if (!kb) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">{t('kbDetail.kbNotFound')}</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm hover:bg-slate-700">
            {t('kbDetail.goHome')}
          </button>
        </div>
      </div>
    );
  }

  const providerLabel = t(`model.${provider}` as string);
  const modelLabel = model || PRESET_MODELS[provider]?.models[0] || '';

  return (
    <div className="h-full flex flex-col">
      {/* Top Bar */}
      <div className="shrink-0 border-b border-slate-800 px-3 py-2.5 lg:px-4 lg:py-3 flex items-center justify-between bg-slate-950/90 backdrop-blur gap-1">
        <div className="flex items-center gap-3 min-w-0">
          {!sidebarOpen && (
            <button onClick={toggleSidebar} className="hidden lg:block p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300">
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => { setActiveKB(null); navigate('/'); }}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-semibold text-slate-200 truncate">{kb.name}</h1>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Embedding status */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-1.5 bg-slate-800/50 rounded-lg text-[10px] text-slate-400">
            <Database className="w-3 h-3" />
            {embeddingProgress
              ? <span>{embeddingProgress.done}/{embeddingProgress.total}</span>
              : <span>{embedStatus.embedded}/{embedStatus.total}</span>}
          </div>

          {/* KB enabled badge - desktop */}
          {!kbEnabled && (
            <div className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium bg-slate-700/30 text-slate-500 border-slate-700">
              <Database className="w-2.5 h-2.5" />
              <span>KB关</span>
            </div>
          )}

          {/* Mode badge - desktop */}
          <div className="hidden lg:block"><AnswerModeBadge mode={effectiveMode} t={t} /></div>

          {/* Web search toggle - sm+ only */}
          <button
            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
            title={webSearchEnabled ? t('kbDetail.webSearchOn') : t('kbDetail.webSearchOff')}
            className={`hidden sm:flex px-2 py-1 rounded-lg text-[10px] font-medium items-center gap-1 transition-all ${
              webSearchEnabled
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                : 'bg-slate-800/50 text-slate-600 border border-slate-700'
            }`}
          >
            {webSearchEnabled ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
            <span>{webSearchEnabled ? '搜索' : '搜索关'}</span>
          </button>

          {/* Provider + Model label */}
          <div className="hidden lg:flex items-center gap-1 text-[10px] text-slate-500 truncate max-w-[140px]">
            <span className="text-slate-600">{providerLabel}</span>
            <span className="text-slate-500">·</span>
            <span className="truncate">{modelLabel}</span>
          </div>

          {/* Language toggle - mobile */}
          <button
            onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
            className="lg:hidden px-2 py-1.5 rounded-lg bg-slate-800 text-xs font-medium text-slate-400"
          >
            {locale === 'zh' ? 'EN' : '中'}
          </button>

          {/* Settings button - mobile */}
          <button
            onClick={() => setMobileView('settings')}
            className={`lg:hidden px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors items-center gap-1 ${
              apiKey ? 'bg-green-500/15 text-green-400 border border-green-500/20'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <Settings className="w-3 h-3" />
          </button>

          {/* Settings button - desktop */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`hidden lg:flex px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors items-center gap-1 ${
              apiKey ? 'bg-green-500/15 text-green-400 border border-green-500/20'
              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
            }`}
          >
            <Settings className="w-3 h-3" />
            {showSettings ? t('kbDetail.save') : t('kbDetail.apiSettings')}
          </button>

          <button
            onClick={() => { if (confirm(`${t('sidebar.deleteConfirm', { name: kb.name })}`)) { deleteKB(kb.id); navigate('/'); } }}
            className="hidden lg:flex p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Settings Panel (desktop only) */}
      <div className="hidden lg:block">
      {showSettings && (
        <div className="kb-settings shrink-0 border-b border-slate-800 bg-slate-900/80 p-4 space-y-4">
          {/* Answer Mode Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{t('kbDetail.modeHint')}:</span>
            <div className="flex gap-1">
              {[
                { value: 'api' as const, label: 'API', icon: <Globe className="w-3 h-3" /> },
                { value: 'text-search' as const, label: '纯文本搜索', icon: <Search className="w-3 h-3" /> },
              ].map((m) => (
                <button key={m.value}
                  onClick={() => setAnswerMode(m.value)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-all ${answerMode === m.value ? "bg-slate-700 text-slate-200 border border-slate-600" : "bg-slate-800/50 text-slate-500 border border-slate-700 hover:border-slate-600"}`}>
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* API Config */}
          {answerMode === 'api' && (
            <>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {(Object.keys(PRESET_MODELS) as ModelProvider[]).filter(p => p !== 'local').map((p) => (
                  <button key={p} onClick={() => setProvider(p)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${provider === p ? "bg-brand-500/15 text-brand-300 border-brand-500/30" : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600"}`}>
                    {provider === p ? '● ' : ''}{t(`model.${p}`)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  placeholder={t('kbDetail.apiKeyPlaceholder')}
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50" />
                {provider === 'custom' && (
                  <input type="text" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)}
                    placeholder={t('kbDetail.apiUrlPlaceholder')}
                    className="flex-[2] px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50" />
                )}
              </div>
              {(PRESET_MODELS[provider]?.models.length > 0 || provider === 'custom') && (
                <div className="flex gap-2 flex-wrap">
                  {PRESET_MODELS[provider]?.models.map((m) => (
                    <button key={m} onClick={() => setModel(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-all ${model === m ? "bg-brand-500/20 text-brand-300 border border-brand-500/30" : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600"}`}>{m}</button>
                  ))}
                  {provider === 'custom' && (
                    <input type="text" value={model} onChange={(e) => setModel(e.target.value)}
                      placeholder={t('kbDetail.customModelPlaceholder')}
                      className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50 min-w-[140px]" />
                  )}
                </div>
              )}
              <p className="text-xs text-slate-600">{t('kbDetail.apiKeyHint')}</p>
            </>
          )}

          {/* Text Search */}
          {answerMode === 'text-search' && (
            <p className="text-xs text-slate-500">使用 BM25 关键词 + 全文搜索从文档中查找相关内容，完全离线，无需 API 或模型。</p>
          )}

          {/* KB Enable Toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <span className="text-xs text-slate-400">启用知识库搜索</span>
              <p className="text-[10px] text-slate-600">关闭后直接调用模型回答，不搜索本地文档</p>
            </div>
            <button onClick={() => setKbEnabled(!kbEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                kbEnabled ? 'bg-brand-500' : 'bg-slate-700'
              }`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                kbEnabled ? 'translate-x-5.5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button onClick={handleSaveSettings} className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors">{t('kbDetail.save')}</button>
          </div>
        </div>
      )}
      </div>

      {/* ===== CONTENT AREA ===== */}

      {/* Mobile: Session selector bar - only in chat view */}
      {mobileView === 'chat' && (
      <div className="lg:hidden shrink-0 border-b border-slate-800 bg-slate-900/50 px-3 py-1.5 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <button
          onClick={handleNewSession}
          className="shrink-0 p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        {sessions.map((s) => (
          <div key={s.id} className="flex items-center shrink-0">
            <button
              onClick={() => handleSwitchSession(s.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap max-w-[100px] truncate transition-colors ${
                activeSessionId === s.id
                  ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s.title}
            </button>
            {sessions.length > 1 && (
              <button
                onClick={() => handleDeleteSession(s.id)}
                className="ml-0.5 p-0.5 rounded text-slate-600 hover:text-red-400"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ))}
        {sessions.length > 0 && (
          <>
            <span className="text-slate-700 shrink-0">|</span>
            {docs.length === 0 ? (
              <button onClick={() => setMobileView('docs')}
                className="shrink-0 text-[11px] text-amber-400 font-medium whitespace-nowrap">
                + {t('kbDetail.docs')}
              </button>
            ) : (
              <button onClick={() => setMobileView('docs')}
                className="shrink-0 text-[11px] text-slate-500 hover:text-slate-300 font-medium whitespace-nowrap">
                📄 {docs.length}
              </button>
            )}
            {chunks.length > 0 && !embedStatus.isReady && !embeddingProgress && (
              <button onClick={handleGenerateEmbeddings}
                className="shrink-0 text-[10px] text-amber-400 font-medium whitespace-nowrap">
                ⚡ {embedStatus.remaining} 未索引
              </button>
            )}
          </>
        )}
      </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop: document sidebar (always visible) */}
        <div className="hidden lg:flex w-80 shrink-0 border-r border-slate-800 overflow-y-auto p-4 flex-col space-y-4">
          <UploadZone onUpload={handleUpload} disabled={processing}
            dropText={t('kbDetail.dropHere')} formatsText={t('kbDetail.supportedFormats')} />
          {processing && (
            <div className="flex items-center gap-2 px-3 py-2 bg-brand-500/10 rounded-lg text-xs text-brand-400">
              <Loader2 className="w-3 h-3 animate-spin" /> {t('kbDetail.processing')}
            </div>
          )}
          {chunks.length > 0 && !embedStatus.isReady && !embeddingProgress && (
            <button onClick={handleGenerateEmbeddings}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg text-xs text-amber-400 font-medium transition-colors">
              <Zap className="w-3 h-3" />
              {t('kbDetail.generateIndex', { remaining: embedStatus.remaining })}
            </button>
          )}
          {embedStatus.isReady && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-400">
              <Zap className="w-3 h-3" /> {t('kbDetail.embeddingReady')}
            </div>
          )}

          {/* Desktop: Session list */}
          {sessions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  💬 对话 ({sessions.length})
                </h3>
                <button onClick={handleNewSession}
                  className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-1">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center">
                    <button
                      onClick={() => handleSwitchSession(s.id)}
                      className={`flex-1 text-left px-2.5 py-1.5 rounded-lg text-xs font-medium truncate transition-colors ${
                        activeSessionId === s.id
                          ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      {s.title}
                    </button>
                    {sessions.length > 1 && (
                      <button onClick={() => handleDeleteSession(s.id)}
                        className="p-0.5 rounded text-slate-600 hover:text-red-400 shrink-0">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              {t('kbDetail.docs')} ({docs.length})
            </h3>
            {docs.length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-4">{t('kbDetail.noDocs')}</p>
            ) : (
              <div className="space-y-1.5">
                {docs.map((doc) => (
                  <div key={doc.id}
                    onClick={() => setPreviewDoc(previewDoc?.id === doc.id ? null : doc)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors group cursor-pointer ${
                      previewDoc?.id === doc.id ? 'bg-brand-500/10 border border-brand-500/20' : 'hover:bg-slate-800/50 border border-transparent'
                    }`}>
                    <span className="text-base shrink-0">{typeIcons[doc.type] || '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate">{doc.name}</p>
                      <p className="text-[10px] text-slate-600">{formatSize(doc.size)} · {doc.chunkCount} chunks</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setPreviewDoc(previewDoc?.id === doc.id ? null : doc); }}
                      className="p-1 rounded hover:bg-brand-500/20 text-slate-500 hover:text-brand-400 transition-all">
                      {previewDoc?.id === doc.id ? <X className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                      className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile: Document panel */}
        {mobileView === 'docs' && (
        <div className={`lg:hidden absolute inset-0 z-20 bg-slate-950 flex flex-col transition-transform duration-200 ${
          mobileView === 'docs' ? 'translate-y-0' : 'translate-y-full'
        }`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0 bg-slate-900">
            <h3 className="text-sm font-medium text-slate-200">{t('kbDetail.docs')}</h3>
            <button onClick={() => setMobileView('chat')}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg">{t('kbDetail.done')}</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <UploadZone onUpload={handleUpload} disabled={processing}
              dropText={t('kbDetail.dropHere')} formatsText={t('kbDetail.supportedFormats')} />
            {processing && (
              <div className="flex items-center gap-2 px-3 py-2 bg-brand-500/10 rounded-lg text-xs text-brand-400">
                <Loader2 className="w-3 h-3 animate-spin" /> {t('kbDetail.processing')}
              </div>
            )}
            {chunks.length > 0 && !embedStatus.isReady && !embeddingProgress && (
              <button onClick={handleGenerateEmbeddings}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg text-xs text-amber-400 font-medium transition-colors">
                <Zap className="w-3 h-3" /> {t('kbDetail.generateIndex', { remaining: embedStatus.remaining })}
              </button>
            )}
            {embedStatus.isReady && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-400">
                <Zap className="w-3 h-3" /> {t('kbDetail.embeddingReady')}
              </div>
            )}
            {docs.length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-8">{t('kbDetail.noDocs')}</p>
            ) : (
              <div className="space-y-1.5">
                {docs.map((doc) => (
                  <div key={doc.id}
                    onClick={() => setPreviewDoc(previewDoc?.id === doc.id ? null : doc)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/50 active:bg-slate-800 cursor-pointer">
                    <span className="text-2xl shrink-0">{typeIcons[doc.type] || '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 truncate">{doc.name}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{formatSize(doc.size)} · {doc.chunkCount} chunks</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                      className="p-2 rounded-lg active:bg-red-500/20 text-slate-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Mobile: Knowledge base sidepanel */}
        {mobileView === 'sidebar' && (
          <div className="lg:hidden absolute inset-0 z-20 bg-slate-950 flex flex-col">
            <MobileSidebar onClose={() => setMobileView('chat')} />
          </div>
        )}

        {/* Document preview (both mobile and desktop) */}
        {previewDoc && (
          <div className="absolute inset-0 z-30 bg-slate-950 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0 bg-slate-900">
              <div>
                <h3 className="text-sm font-medium text-slate-200 truncate">{previewDoc.name}</h3>
                <p className="text-[10px] text-slate-600">{formatSize(previewDoc.size)} · {previewDoc.chunkCount} chunks</p>
              </div>
              <button onClick={() => setPreviewDoc(null)}
                className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                {previewDoc.content
                  ? previewDoc.content.length > 50000
                    ? previewDoc.content.slice(0, 50000) + `\n\n... (已截断，剩余 ${formatSize(previewDoc.content.length - 50000)} 内容)`
                    : previewDoc.content
                  : t('kbDetail.noPreview')}
              </pre>
            </div>
          </div>
        )}

        {/* Mobile: Settings panel (fullscreen overlay) */}
        {mobileView === 'settings' && (
        <div className="lg:hidden absolute inset-0 z-20 bg-slate-950 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0 bg-slate-900">
            <h3 className="text-sm font-medium text-slate-200">{t('kbDetail.apiSettings')}</h3>
            <button onClick={() => setMobileView('chat')}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
              {t('kbDetail.done')}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Provider selector */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">{t('kbDetail.providerLabel')}</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PRESET_MODELS) as ModelProvider[]).filter(p => p !== 'local').map((p) => (
                  <button key={p} onClick={() => setProvider(p)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                      provider === p ? 'bg-brand-500/15 text-brand-300 border-brand-500/30' : 'bg-slate-800/50 text-slate-400 border-slate-700'
                    }`}>
                    {provider === p ? '● ' : ''}{t(`model.${p}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">{t('kbDetail.apiKeyPlaceholder')}</label>
              <input type="password" value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500/50" />
            </div>

            {/* Model selector */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">{t('kbDetail.modelLabel')}</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_MODELS[provider]?.models.map((m) => (
                  <button key={m} onClick={() => setModel(m)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      model === m ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30' : 'bg-slate-800/50 text-slate-400 border border-slate-700'
                    }`}>{m}</button>
                ))}
              </div>
            </div>

            {/* Answer mode */}
            <div>
              <label className="text-xs text-slate-400 mb-2 block">{t('kbDetail.modeHint')}</label>
              <div className="flex gap-2">
                {[
                  { value: 'api' as const, label: 'API', icon: <Globe className="w-3 h-3" /> },
                  { value: 'text-search' as const, label: '文本搜索', icon: <Search className="w-3 h-3" /> },
                ].map((m) => (
                  <button key={m.value} onClick={() => setAnswerMode(m.value)}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                      answerMode === m.value ? 'bg-slate-700 text-slate-200 border border-slate-600' : 'bg-slate-800/50 text-slate-500 border border-slate-700'
                    }`}>
                    {m.icon}{m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Knowledge base toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="text-xs text-slate-400">启用知识库搜索</span>
                <p className="text-[10px] text-slate-600">关闭后直接调用模型</p>
              </div>
              <button onClick={() => setKbEnabled(!kbEnabled)}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  kbEnabled ? 'bg-brand-500' : 'bg-slate-700'
                }`}>
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
                  kbEnabled ? 'translate-x-5.5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Web search toggle */}
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-slate-400">{t('kbDetail.webSearch')}</span>
              <button onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  webSearchEnabled ? 'bg-brand-500' : 'bg-slate-700'
                }`}>
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
                  webSearchEnabled ? 'translate-x-5.5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Save button */}
            <button onClick={handleSaveSettings}
              className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors">
              {t('kbDetail.save')}
            </button>
          </div>
        </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 lg:space-y-4">
            {messages.length === 0 && !chatting && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Sparkles className="w-12 h-12 text-slate-800 mb-4" />
                <p className="text-sm text-slate-500 mb-2">{t('kbDetail.welcome1')}</p>
                <p className="text-xs text-slate-600 max-w-xs">
                  {docs.length === 0
                    ? t('kbDetail.welcome2')
                    : chunks.length > 0 && !embedStatus.isReady
                      ? t('kbDetail.welcome3')
                      : t('kbDetail.welcome4')}
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <ChatBubble key={i} message={msg} />
            ))}

            {chatting && (streamingContent || streamingReasoning) && (
              <ChatBubble
                message={{ role: 'assistant', content: streamingContent }}
                reasoning={streamingReasoning}
                isStreaming
              />
            )}
            {chatting && !streamingContent && !streamingReasoning && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-slate-800/80">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce [animation-delay:0.15s]" />
                    <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-slate-800 px-3 lg:px-4 py-2.5 lg:py-3 bg-slate-950/90 backdrop-blur pb-14 lg:pb-3">
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="relative flex-1">
                <textarea
                  ref={(el) => { if (el && input === '') el.value = ''; }}
                  value={input} onChange={(e) => setInput(e.target.value)}
                  onCompositionStart={() => { composingRef.current = true; }}
                  onCompositionEnd={() => { composingRef.current = false; }}
                  placeholder={t('kbDetail.chatPlaceholder')}
                  className="w-full resize-none pl-3 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/50 min-h-[42px] max-h-24"
                  rows={1}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) { e.preventDefault(); handleSend(); } }}
                />
              </div>
              {chatting ? (
                <button onClick={handleStop}
                  className="shrink-0 w-10 h-10 flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors">
                  <StopCircle className="w-5 h-5" />
                </button>
              ) : (
                <button onClick={handleSend} disabled={!input.trim()}
                  className="shrink-0 w-10 h-10 flex items-center justify-center bg-brand-500 hover:bg-brand-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition-colors disabled:cursor-not-allowed">
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* ===== END CONTENT AREA ===== */}
    </div>
  );
}
