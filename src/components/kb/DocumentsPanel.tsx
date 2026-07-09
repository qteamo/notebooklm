import { useState } from 'react';
import { Loader2, Zap, Eye, X, Trash2 } from 'lucide-react';
import type { Document, Chunk } from '../../db';
import { getEmbeddingStatus } from '../../lib';
import UploadZone from './UploadZone';

const typeIcons: Record<string, string> = { pdf: '📕', docx: '📘', md: '📝', txt: '📄' };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface DocumentsPanelProps {
  docs: Document[];
  chunks: Chunk[];
  processing: boolean;
  embeddingProgress: { done: number; total: number } | null;
  onUpload: (files: FileList) => void;
  onGenerateEmbeddings: () => void;
  onDelete: (docId: string) => void;
  onPreview: (doc: Document | null) => void;
  previewDoc: Document | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export default function DocumentsPanel({
  docs,
  chunks,
  processing,
  embeddingProgress,
  onUpload,
  onGenerateEmbeddings,
  onDelete,
  onPreview,
  previewDoc,
  t,
}: DocumentsPanelProps) {
  const embedStatus = getEmbeddingStatus(chunks);

  return (
    <div className="flex flex-col space-y-4">
      <UploadZone
        onUpload={onUpload}
        disabled={processing}
        dropText={t('kbDetail.dropHere')}
        formatsText={t('kbDetail.supportedFormats')}
      />

      {processing && (
        <div className="flex items-center gap-2 px-3 py-2 bg-brand-500/10 rounded-lg text-xs text-brand-400">
          <Loader2 className="w-3 h-3 animate-spin" /> {t('kbDetail.processing')}
        </div>
      )}

      {chunks.length > 0 && !embedStatus.isReady && !embeddingProgress && (
        <button
          onClick={onGenerateEmbeddings}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg text-xs text-amber-400 font-medium transition-colors"
        >
          <Zap className="w-3 h-3" />
          {t('kbDetail.generateIndex', { remaining: embedStatus.remaining })}
        </button>
      )}

      {embedStatus.isReady && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-400">
          <Zap className="w-3 h-3" /> {t('kbDetail.embeddingReady')}
        </div>
      )}

      {embeddingProgress && (
        <div className="flex items-center gap-2 px-3 py-2 bg-brand-500/10 rounded-lg text-xs text-brand-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          {t('kbDetail.indexing', { done: embeddingProgress.done, total: embeddingProgress.total })}
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
              <div
                key={doc.id}
                onClick={() => onPreview(previewDoc?.id === doc.id ? null : doc)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors group cursor-pointer ${
                  previewDoc?.id === doc.id
                    ? 'bg-brand-500/10 border border-brand-500/20'
                    : 'hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <span className="text-base shrink-0">{typeIcons[doc.type] || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">{doc.name}</p>
                  <p className="text-[10px] text-slate-600">
                    {formatSize(doc.size)} · {doc.chunkCount} chunks
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreview(previewDoc?.id === doc.id ? null : doc);
                  }}
                  className="p-1 rounded hover:bg-brand-500/20 text-slate-500 hover:text-brand-400 transition-all"
                >
                  {previewDoc?.id === doc.id ? <X className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(doc.id);
                  }}
                  className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { formatSize, typeIcons };
