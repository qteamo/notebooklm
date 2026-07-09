import type { Chunk } from '../db';

// ── Embedding Service ─────────────────────────────
// Uses Transformers.js with all-MiniLM-L6-v2 (runs fully in-browser)

let embedderInstance: Awaited<ReturnType<typeof makeEmbedder>> | null = null;
let embedderError: string | null = null;

async function makeEmbedder() {
  const { pipeline } = await import('@xenova/transformers');
  return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
}

async function getEmbedder() {
  if (embedderError) throw new Error(embedderError);
  if (!embedderInstance) {
    try {
      embedderInstance = makeEmbedder();
      await embedderInstance; // Wait for download
    } catch (err) {
      embedderError = err instanceof Error ? err.message : 'Unknown embedding error';
      embedderInstance = null;
      throw err;
    }
  }
  return embedderInstance;
}

// ── Auto-indexing queue ───────────────────────────

let autoIndexRunning = false;
let autoIndexQueue = new Set<string>(); // kbIds to process

export function enqueueAutoIndex(kbId: string) {
  autoIndexQueue.add(kbId);
  // Fire and forget — runs in background
  runAutoIndex().catch((err) => console.warn('⚠️ Auto-index error:', err));
}

async function runAutoIndex() {
  if (autoIndexRunning) return;
  autoIndexRunning = true;

  try {
    while (autoIndexQueue.size > 0) {
      const kbId = autoIndexQueue.values().next().value!;
      autoIndexQueue.delete(kbId);

      try {
        const { getUnembeddedChunks } = await import('./documents');
        const unembedded = await getUnembeddedChunks(kbId);
        if (unembedded.length > 0) {
          console.debug(`🤖 Auto-indexing ${unembedded.length} chunks for KB ${kbId}...`);
          await embedChunks(unembedded, (done, total) => {
            console.debug(`  Indexing: ${done}/${total}`);
          });
          console.debug('✅ Auto-indexing complete');
        }
      } catch (err) {
        console.warn('⚠️ Auto-indexing failed for KB', kbId, ':', err);
      }
    }
  } finally {
    autoIndexRunning = false;
  }
}

// ── Generate embeddings for chunks ─────────────────

export async function embedChunks(
  chunks: Chunk[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (chunks.length === 0) return;

  const embedder = await getEmbedder();
  let done = 0;

  const BATCH_SIZE = 8;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (chunk) => {
        const output = await embedder([chunk.text], {
          pooling: 'mean',
          normalize: true,
        });
        return {
          id: chunk.id,
          embedding: Array.from(output.data as Float32Array) as number[],
        };
      }),
    );

    const { updateChunkEmbedding } = await import('./documents');
    for (const r of results) {
      await updateChunkEmbedding(r.id, r.embedding);
    }

    done += batch.length;
    onProgress?.(done, chunks.length);
  }
}

// ── Embed a single query ──────────────────────────

export async function embedQuery(query: string): Promise<number[]> {
  const embedder = await getEmbedder();
  const output = await embedder([query], {
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(output.data as Float32Array) as number[];
}

// ── Cosine similarity ─────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Semantic Search ───────────────────────────────

export interface SearchResult {
  chunk: Chunk;
  score: number;
  docName: string;
  docType: string;
}

export async function semanticSearch(
  chunks: Chunk[],
  query: string,
  topK = 10,
): Promise<SearchResult[]> {
  const embedded = chunks.filter((c) => c.embedding !== null);
  if (embedded.length === 0) return [];

  const queryEmbedding = await embedQuery(query);

  const { documents: docTable } = await import('../db');
  const docCache = new Map<string, string>();

  const scored = embedded
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding!),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return await Promise.all(
    scored.map(async ({ chunk, score }) => {
      if (!docCache.has(chunk.docId)) {
        const doc = await docTable.get(chunk.docId);
        docCache.set(chunk.docId, doc?.name ?? 'unknown');
      }
      return {
        chunk,
        score,
        docName: docCache.get(chunk.docId)!,
        docType: chunk.docId.substring(0, 4),
      };
    }),
  );
}

// ── Embedding Status ──────────────────────────────

export interface EmbeddingStatus {
  total: number;
  embedded: number;
  remaining: number;
  isReady: boolean;
}

export function getEmbeddingStatus(chunks: Chunk[]): EmbeddingStatus {
  const total = chunks.length;
  const embedded = chunks.filter((c) => c.embedding !== null).length;
  return { total, embedded, remaining: total - embedded, isReady: embedded === total && total > 0 };
}
