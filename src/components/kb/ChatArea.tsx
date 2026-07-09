import { useRef, useEffect } from 'react';
import { Sparkles, Loader2, Brain } from 'lucide-react';

function ChatBubble({
  message,
  isStreaming,
  reasoning,
}: {
  message: { role: string; content: string; reasoning?: string };
  isStreaming?: boolean;
  reasoning?: string;
}) {
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
        {!isUser && displayReasoning && (
          <div className="border border-amber-500/20 rounded-xl overflow-hidden">
            <button
              onClick={() => setReasoningOpen(!reasoningOpen)}
              className="w-full flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-xs text-amber-400 hover:bg-amber-500/15 transition-colors"
            >
              <Brain className="w-3 h-3" />
              <span>思考过程</span>
              <span className="ml-auto text-[10px] text-amber-500/60">
                {reasoningOpen ? '收起' : '展开'}
              </span>
            </button>
            {reasoningOpen && (
              <div className="px-3 py-2 text-xs text-amber-300/70 whitespace-pre-wrap leading-relaxed bg-amber-500/5 max-h-48 overflow-y-auto">
                {displayReasoning}
              </div>
            )}
          </div>
        )}
        <div
          className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-brand-500/20 text-slate-200 rounded-br-md'
              : 'bg-slate-800/80 text-slate-300 rounded-bl-md'
          }`}
        >
          {message.content}
          {isStreaming && (
            <span className="inline-block w-2 h-5 bg-brand-400 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';

export { ChatBubble };

export function LoadingDots() {
  return (
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
  );
}

interface ChatAreaProps {
  messages: { role: string; content: string; reasoning?: string }[];
  chatting: boolean;
  streamingContent: string;
  streamingReasoning: string;
  docsLength: number;
  chunksLength: number;
  embedStatus: { isReady: boolean };
  t: (key: string, params?: Record<string, string | number>) => string;
}

export default function ChatArea({
  messages,
  chatting,
  streamingContent,
  streamingReasoning,
  docsLength,
  chunksLength,
  embedStatus,
  t,
}: ChatAreaProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, streamingContent, streamingReasoning]);

  return (
    <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-3 lg:space-y-4">
      {messages.length === 0 && !chatting && (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <Sparkles className="w-12 h-12 text-slate-800 mb-4" />
          <p className="text-sm text-slate-500 mb-2">{t('kbDetail.welcome1')}</p>
          <p className="text-xs text-slate-600 max-w-xs">
            {docsLength === 0
              ? t('kbDetail.welcome2')
              : chunksLength > 0 && !embedStatus.isReady
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
      {chatting && !streamingContent && !streamingReasoning && <LoadingDots />}
      <div ref={chatEndRef} />
    </div>
  );
}
