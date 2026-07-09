import type { SearchResult } from './embedding';

// ── Model Provider Types ──────────────────────────

export type ModelProvider = 'openai' | 'anthropic' | 'deepseek' | 'custom' | 'local';

export interface ModelConfig {
  provider: ModelProvider;
  apiKey: string;
  apiUrl: string;
  model: string;
}

export const PRESET_MODELS: Record<ModelProvider, { url: string; models: string[] }> = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o4-mini'],
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
  },
  deepseek: {
    url: 'https://api.deepseek.com/chat/completions',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  custom: {
    url: '',
    models: [],
  },
  local: {
    url: '',
    models: [],
  },
};

// ── WebLLM (Local LLM) ────────────────────────────

type WebLLMEngine = Awaited<ReturnType<typeof createWebLLMEngine>>;
let webLLMEngine: WebLLMEngine | null = null;
let webLLMLoading = false;

export const LOCAL_MODELS = [
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 3B', size: '~1.8GB' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B', size: '~700MB' },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi-3.5 Mini', size: '~2.2GB' },
  { id: 'gemma-2-2b-it-q4f16_1-MLC', name: 'Gemma 2 2B', size: '~1.4GB' },
];

async function createWebLLMEngine(modelId: string) {
  const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
  return CreateMLCEngine(modelId, {
    initProgressCallback: (report) => {
      console.debug(`WebLLM loading: ${report.text} (${Math.round(report.progress * 100)}%)`);
    },
  });
}

export async function getWebLLM(modelId?: string): Promise<{ engine: NonNullable<typeof webLLMEngine>; model: string }> {
  const model = modelId || LOCAL_MODELS[0].id;

  // If we have an engine but for a different model, reload
  if (webLLMEngine && webLLMEngine.modelId !== model) {
    webLLMEngine = null;
  }

  if (!webLLMEngine && !webLLMLoading) {
    webLLMLoading = true;
    try {
      webLLMEngine = await createWebLLMEngine(model);
    } finally {
      webLLMLoading = false;
    }
  }

  if (!webLLMEngine) {
    throw new Error('Local LLM failed to load. The model may still be downloading.');
  }

  return { engine: webLLMEngine, model };
}

export function getWebLLMLoadingProgress(): string {
  return webLLMLoading ? 'loading' : webLLMEngine ? 'ready' : 'idle';
}

// ── Chat Prompt Builder ───────────────────────────

export interface AskOptions {
  query: string;
  context: SearchResult[];
  chatHistory: { role: 'user' | 'assistant'; content: string }[];
  mode?: 'api' | 'local' | 'text-search';
  provider?: ModelProvider;
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  webSearch?: boolean;
  webSearchContext?: string;
}

function buildPrompt(options: AskOptions, locale: 'zh' | 'en' = 'en'): string {
  const { query, context, chatHistory, webSearchContext } = options;

  const contextStr = context
    .map((r, i) => `[Source ${i + 1} from "${r.docName}"]\n${r.chunk.text}`)
    .join('\n\n');

  const historyStr = chatHistory
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const isZh = locale === 'zh';

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const systemPrompt = isZh
    ? `你是一个 AI 助手。当前日期: ${todayStr}。\n回答规则：\n• 如果文档上下文有相关信息，优先使用，并引用 [Source N] 标注来源。\n• 如果文档上下文不够，可用网络搜索结果补充，标注 [Web N]。\n• 如果文档和网络搜索都没有有效信息，请直接基于你的知识回答，不要只说「文档没有相关内容」。\n• 对于时效性问题，已知当前日期，请根据你的训练数据给出最相关的信息。\n• 简明准确，请用中文回答。`
    : `You are an AI assistant. Current date: ${todayStr}.\nAnswer rules:\n• Prioritize document context with [Source N] citations when available.\n• Use web search results as supplement, cite as [Web N].\n• When neither documents nor web search provide useful info, answer directly from your own knowledge. Never just say "no relevant content in documents".\n• For time-sensitive questions, you know today's date — answer with the most relevant info from your training data.\n• Be concise and accurate. Respond in the same language as the user.`;

  const webSection = webSearchContext
    ? `\n\n## Web Search Results\n${webSearchContext}\n`
    : '';

  return `${systemPrompt}

## Document Context
${contextStr || '(No relevant context found)'}${webSection}

## Conversation History
${historyStr}

## User Question
${query}

## Answer`;
}

// ── Text Search Result Formatter ──────────────────
// Returns meaningful results from keyword search WITHOUT any API

export function formatTextSearchResults(
  query: string,
  results: SearchResult[],
  locale: 'zh' | 'en',
): string {
  if (results.length === 0) {
    return locale === 'zh'
      ? '没有在文档中找到与你的问题相关的内容。请尝试：\n\n• 使用不同的关键词重新提问\n• 上传更多相关文档\n• 生成 AI 索引以获得更精准的语义搜索'
      : 'No relevant content found in your documents. Try:\n\n• Rephrasing your question with different keywords\n• Uploading more relevant documents\n• Generating AI embeddings for better semantic search';
  }

  const isZh = locale === 'zh';
  const lines: string[] = [];

  lines.push(
    isZh
      ? `🔍 基于关键词搜索，在 ${results.length} 个相关片段中找到以下内容：\n`
      : `🔍 Found ${results.length} relevant chunks via keyword search:\n`,
  );

  results.forEach((r, i) => {
    const preview = r.chunk.text.slice(0, 200) + (r.chunk.text.length > 200 ? '...' : '');
    lines.push(
      isZh
        ? `--- [来源 ${i + 1}: ${r.docName}] ---\n${preview}\n`
        : `--- [Source ${i + 1}: ${r.docName}] ---\n${preview}\n`,
    );
  });

  lines.push(
    isZh
      ? '💡 提示：配置 API Key 或加载本地模型可以获取 AI 驱动的智能回答。点击上方「API 设置」或「本地模型」按钮。'
      : '💡 Tip: Configure an API key or load a local model to get AI-powered answers. Click the "API Settings" or "Local Model" button above.',
  );

  return lines.join('\n');
}

// ── Remote API Call ───────────────────────────────

async function callRemoteAPI(
  prompt: string,
  config: ModelConfig,
): Promise<string> {
  // Handle Anthropic's different API format
  if (config.provider === 'anthropic') {
    const res = await fetch(config.apiUrl || 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text || 'No response.';
  }

  // OpenAI-compatible (DeepSeek, OpenAI, etc.)
  const isDeepSeek = config.provider === 'deepseek';
  const url = config.apiUrl || 'https://api.openai.com/v1/chat/completions';

  const body: Record<string, unknown> = {
    model: config.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Cite document sources when available. If no relevant info in context, answer from your own knowledge. Be concise and accurate.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1024,
    temperature: 0.3,
  };

  // DeepSeek: enable thinking for reasoner, disable for chat (faster)
  if (isDeepSeek) {
    if (config.model === 'deepseek-reasoner') {
      body.thinking = { type: 'enabled' };
    } else {
      body.thinking = { type: 'disabled' };
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'No response.';
}

// ── Local LLM (WebLLM) ────────────────────────────

async function callLocalWebLLM(prompt: string, modelId: string): Promise<string> {
  const { engine } = await getWebLLM(modelId);
  const reply = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: 'Cite document sources when available. If no relevant info, answer from your own knowledge. Be concise and accurate.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1024,
    temperature: 0.3,
  });
  return reply.choices[0]?.message?.content || 'No response.';
}

// ── Main Non-streaming Ask ────────────────────────

export async function ask(options: AskOptions, locale: 'zh' | 'en' = 'zh'): Promise<string> {
  const hasWebFallback = options.webSearch && options.webSearchContext && !options.webSearchContext.includes('网络搜索暂时不可用');
  if (!options.apiKey && options.mode !== 'local') {
    if (options.context.length === 0 && !hasWebFallback) {
      return formatNoResultsMessage(options.query, locale);
    }
    return formatTextSearchResults(options.query, options.context, locale);
  }

  const prompt = buildPrompt(options, locale);

  // Mode: local WebLLM
  if (options.mode === 'local') {
    return callLocalWebLLM(prompt, options.model || LOCAL_MODELS[0].id);
  }

  // Mode: remote API
  if (options.apiKey) {
    const config: ModelConfig = {
      provider: options.provider || 'openai',
      apiKey: options.apiKey,
      apiUrl: options.apiUrl || PRESET_MODELS[options.provider || 'openai'].url,
      model: options.model || PRESET_MODELS[options.provider || 'openai'].models[0],
    };
    return callRemoteAPI(prompt, config);
  }

  return formatTextSearchResults(options.query, options.context, locale);
}

function formatNoResultsMessage(query: string, locale: 'zh' | 'en'): string {
  return locale === 'zh'
    ? `🔍 没有在文档中找到与「${query}」相关的内容。\n\n📌 可能的原因：\n• 关键词不在文档中 — 试试换个说法，比如用文档里出现的词汇\n• AI 索引正在后台生成中 — 等待片刻后再试\n• 文档刚上传 — 首次索引需要下载 AI 模型（约 80MB）\n\n💡 当前使用的是混合检索（语义 + 关键词 + 全文回退），已自动覆盖多种检索策略。如持续搜不到，请确认文档内容是否与问题相关。`
    : `🔍 No content found in documents matching "${query}".\n\n📌 Possible reasons:\n• Keywords not in documents — try rephrasing with words that appear in your docs\n• AI index is being generated in the background — wait a moment and try again\n• Documents just uploaded — first index requires downloading the AI model (~80MB)\n\n💡 Search already uses hybrid retrieval (semantic + keyword + full-text fallback). If results are still empty, check whether your documents are relevant to the question.`;
}

// ── Streaming Ask ─────────────────────────────────

export interface StreamEvent {
  type: 'content' | 'reasoning_start' | 'reasoning_end';
  text: string;
}

export async function* askStream(
  options: AskOptions,
  locale: 'zh' | 'en' = 'zh',
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  // Abort check helper
  const checkAbort = () => { if (signal?.aborted) throw new DOMException('Aborted', 'AbortError'); };

  // No API key AND no web results → local fallbacks only
  const hasWebFallback = options.webSearch && options.webSearchContext && !options.webSearchContext.includes('网络搜索暂时不可用');
  if (!options.apiKey && options.mode !== 'local') {
    if (options.context.length === 0 && !hasWebFallback) {
      const text = formatNoResultsMessage(options.query, locale);
      yield* emitTextInBatches(text);
      return;
    }
    const text = formatTextSearchResults(options.query, options.context, locale);
    yield* emitTextInBatches(text);
    return;
  }

  // Has API key → build prompt and call AI
  const prompt = buildPrompt(options, locale);

  // Local LLM (non-streaming for simplicity, batched)
  if (options.mode === 'local') {
    const text = await callLocalWebLLM(prompt, options.model || LOCAL_MODELS[0].id);
    yield* emitTextInBatches(text);
    return;
  }

  // Streaming remote API
  if (options.apiKey) {
    const provider = options.provider || 'openai';
    const model = options.model || PRESET_MODELS[provider].models[0];
    const apiKey = options.apiKey;
    const apiUrl = options.apiUrl || PRESET_MODELS[provider].url;
    const isDeepSeek = provider === 'deepseek';

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: 'Be concise, accurate, and cite sources. Use provided context first; if it lacks info, answer from your own knowledge.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1024,
      temperature: 0.3,
      stream: true,
    };

    // DeepSeek-specific: stream_options + thinking mode
    if (isDeepSeek) {
      body.stream_options = { include_usage: true };
      if (model === 'deepseek-reasoner') {
        body.thinking = { type: 'enabled' };
      } else {
        body.thinking = { type: 'disabled' };
      }
    }

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errMsg = `API error (${res.status})`;
      try {
        const errBody = await res.text();
        // Only include first 200 chars of error, strip potential key leaks
        errMsg += `: ${errBody.slice(0, 200)}`;
      } catch { /* ignore */ }
      throw new Error(errMsg);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response stream');

    // Listen for abort signal on reader
    if (signal) {
      signal.addEventListener('abort', () => reader.cancel('User cancelled'), { once: true });
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let reasoningOpen = false;

    while (true) {
      checkAbort();
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            if (reasoningOpen) {
              yield { type: 'reasoning_end', text: '' };
            }
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            // DeepSeek reasoning/thinking content
            const reasoning = delta?.reasoning_content;
            if (reasoning) {
              if (!reasoningOpen) {
                reasoningOpen = true;
                yield { type: 'reasoning_start', text: '' };
              }
              yield { type: 'content', text: reasoning };
              continue;
            }

            // Close reasoning block when content starts flowing
            if (reasoningOpen) {
              reasoningOpen = false;
              yield { type: 'reasoning_end', text: '' };
            }

            const content = delta?.content;
            if (content) yield { type: 'content', text: content };
          } catch { /* skip */ }
        }
      }
    }
    if (reasoningOpen) {
      yield { type: 'reasoning_end', text: '' };
    }
    return;
  }

  // Fallback: text search
  const text = formatTextSearchResults(options.query, options.context, locale);
  yield* emitTextInBatches(text);
}
