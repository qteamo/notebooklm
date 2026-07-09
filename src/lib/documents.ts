import { db, type Document, type Chunk } from '../db';

// ── Text Splitting ────────────────────────────────

export function splitIntoSentences(text: string): string[] {
  // Support Chinese/English/Japanese punctuation with proper boundary handling
  const splitText = text
    .replace(/([.。!！?？;；:：\n\r]{1,2})\s*/g, '$1|||')
    .replace(/([\u4e00-\u9fff])([\u4e00-\u9fff]{20,})/g, '$1$2|||')
    .split('|||')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Merge very short fragments
  const merged: string[] = [];
  for (const s of splitText) {
    if (merged.length > 0 && merged[merged.length - 1].length + s.length < 100) {
      merged[merged.length - 1] += ' ' + s;
    } else {
      merged.push(s);
    }
  }
  return merged;
}

export function chunkText(text: string, maxChunkSize = 500): string[] {
  const sentences = splitIntoSentences(text);
  const chunks: string[] = [];
  let current = '';

  // Handle super-long sentences that exceed maxChunkSize
  for (let sentence of sentences) {
    while (sentence.length > maxChunkSize) {
      if (current.trim()) chunks.push(current.trim());
      // For Chinese text, cut at character boundary
      current = sentence.slice(0, maxChunkSize);
      sentence = sentence.slice(maxChunkSize);
      chunks.push(current.trim());
      current = '';
    }

    if (current.length + sentence.length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function uid(): string {
  return crypto.randomUUID();
}

// ── Document Processing ───────────────────────────

export async function processDocument(
  kbId: string,
  file: File,
  onChunksReady?: (chunks: Omit<Chunk, 'embedding'>[]) => void,
): Promise<Document> {
  const startTime = performance.now();
  const id = uid();
  let content = '';

  const ext = file.name.split('.').pop()?.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  switch (ext) {
    case 'txt':
    case 'md':
    case 'markdown':
      content = await file.text();
      break;
    case 'pdf':
      content = await extractPdfText(arrayBuffer);
      break;
    case 'docx':
      content = await extractDocxText(arrayBuffer);
      break;
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }

  const chunkTexts = chunkText(content);
  const chunkRecords: Omit<Chunk, 'embedding'>[] = chunkTexts.map((text, i) => ({
    id: `${id}-chunk-${i}`,
    docId: id,
    kbId,
    index: i,
    text,
  }));

  const doc: Document = {
    id,
    kbId,
    name: file.name,
    type: (ext === 'markdown' ? 'md' : ext) as Document['type'],
    content,
    rawData: arrayBuffer,
    size: file.size,
    chunkCount: chunkRecords.length,
    createdAt: Date.now(),
  };

  await db.documents.add(doc);

  // Store chunks WITHOUT embeddings (will be generated async)
  const fullChunks: Chunk[] = chunkRecords.map((c) => ({ ...c, embedding: null }));
  await db.chunks.bulkAdd(fullChunks);
  await db.knowledgeBases.update(kbId, { updatedAt: Date.now() });

  if (import.meta.env.DEV) {
    console.debug(
      `📄 Processed "${file.name}" in ${(performance.now() - startTime).toFixed(0)}ms: ${chunkRecords.length} chunks`,
    );
  }

  // Notify caller so they can start embedding
  onChunksReady?.(chunkRecords);

  return doc;
}

// ── PDF / DOCX Extraction ─────────────────────────

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  // Use CDN for PDF worker to avoid bundling issues
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs';

  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= Math.min(pdf.numPages, 100); i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: { str: string }) => item.str).join(' ');
    pages.push(text);
  }
  return pages.join('\n');
}

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

// ── Chunk CRUD ────────────────────────────────────

export async function getKBChunks(kbId: string): Promise<Chunk[]> {
  return db.chunks.where('kbId').equals(kbId).toArray();
}

export async function getUnembeddedChunks(kbId: string): Promise<Chunk[]> {
  return db.chunks
    .where('kbId')
    .equals(kbId)
    .filter((c) => c.embedding === null)
    .toArray();
}

export async function updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
  await db.chunks.update(chunkId, { embedding });
}

export async function getKBDocuments(kbId: string): Promise<Document[]> {
  return db.documents.where('kbId').equals(kbId).toArray();
}

export async function deleteDocument(docId: string): Promise<void> {
  await db.documents.delete(docId);
  await db.chunks.where('docId').equals(docId).delete();
}

// ── BM25 Text Search ──────────────────────────────

interface BM25Config { k1: number; b: number }

function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  avgDocLen: number,
  totalDocs: number,
  docFreq: Map<string, number>,
  config: BM25Config = { k1: 1.5, b: 0.75 },
): number {
  const docLen = docTokens.length;
  const termFreq = new Map<string, number>();
  for (const t of docTokens) termFreq.set(t, (termFreq.get(t) || 0) + 1);

  let score = 0;
  for (const token of new Set(queryTokens)) {
    const tf = termFreq.get(token) || 0;
    const df = docFreq.get(token) || 0;
    if (tf === 0 || df === 0) continue;

    const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
    const numerator = tf * (config.k1 + 1);
    const denominator = tf + config.k1 * (1 - config.b + config.b * (docLen / avgDocLen));
    score += idf * (numerator / denominator);
  }
  return score;
}

function tokenize(text: string): string[] {
  // Chinese: character-level bigrams; English: word-level lowercased
  const hasChinese = /[\u4e00-\u9fff]/.test(text);
  if (hasChinese) {
    // For Chinese, use character bigrams for better matching
    const chars = text.replace(/[^\u4e00-\u9fff\w]/g, '').split('');
    const bigrams: string[] = [];
    for (let i = 0; i < chars.length - 1; i++) {
      bigrams.push(chars[i] + chars[i + 1]);
    }
    // Also include individual chars for single-character queries
    return [...new Set([...chars, ...bigrams])];
  }
  return text.toLowerCase().split(/\s+/).filter(t => t.length > 0);
}

/**
 * BM25-based keyword search. Much better than simple overlap scoring.
 */
export async function bm25Search(
  kbId: string,
  query: string,
  topK = 10,
): Promise<{ chunk: Chunk; doc: Document; score: number }[]> {
  const allChunks = await getKBChunks(kbId);
  if (allChunks.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Build corpus stats
  const docTokensList = allChunks.map((c) => tokenize(c.text));
  const avgDocLen = docTokensList.reduce((s, t) => s + t.length, 0) / allChunks.length;
  const docFreq = new Map<string, number>();
  for (const tokens of docTokensList) {
    for (const token of new Set(tokens)) {
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    }
  }

  // Score all chunks
  const scored = allChunks
    .map((chunk, i) => ({
      chunk,
      score: bm25Score(
        queryTokens,
        docTokensList[i],
        avgDocLen,
        allChunks.length,
        docFreq,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Lookup documents
  const results = await Promise.all(
    scored.map(async ({ chunk, score }) => {
      const doc = await db.documents.get(chunk.docId);
      return { chunk, doc: doc!, score };
    }),
  );

  return results;
}

// ── Full-text fallback search ─────────────────────

/**
 * Last resort: search full document content (not chunks) by splitting into
 * large segments and matching. Used when both embedding and keyword search fail.
 */
export async function fullTextSearch(
  kbId: string,
  query: string,
  topK = 5,
): Promise<{ chunk: Chunk; doc: Document; score: number }[]> {
  const docs = await getKBDocuments(kbId);
  if (docs.length === 0) return [];

  const lowerQuery = query.toLowerCase();
  const results: { chunk: Chunk; doc: Document; score: number }[] = [];

  for (const doc of docs) {
    const docContent = doc.content;

    // Split full doc into ~1000-char overlapping windows
    const windowSize = 1000;
    const overlap = 200;
    let windowIndex = 0;

    for (let start = 0; start < docContent.length; start += windowSize - overlap) {
      const text = docContent.slice(start, start + windowSize).trim();
      if (text.length < 20) continue;

      const lowerText = text.toLowerCase();
      let score = 0;

      // Check query words
      const words = lowerQuery.split(/\s+/).filter(w => w.length > 0);
      for (const word of words) {
        const count = lowerText.split(word).length - 1;
        score += count;
      }
      // Bonus for exact phrase
      if (lowerText.includes(lowerQuery)) score += 5;

      if (score > 0) {
        // Create a synthetic chunk for this window
        const syntheticChunk: Chunk = {
          id: `${doc.id}-window-${windowIndex}`,
          docId: doc.id,
          kbId: doc.kbId,
          index: windowIndex,
          text,
          embedding: null,
        };
        results.push({ chunk: syntheticChunk, doc, score: score / Math.sqrt(text.length / 100) });
        windowIndex++;
      }
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── Hybrid Search (Multi-recall) ──────────────────

import type { SearchResult } from './embedding';

/**
 * Multi-recall hybrid search:
 * 1. Try semantic search (if embeddings exist)
 * 2. Try BM25 keyword search
 * 3. Merge results by deduplication
 * 4. If still nothing, fall back to full-text window search
 */
export async function hybridSearch(
  kbId: string,
  query: string,
  chunks: Chunk[],
  semanticSearchFn: (chunks: Chunk[], query: string, topK: number) => Promise<SearchResult[]>,
  topK = 10,
): Promise<SearchResult[]> {
  const embedded = chunks.filter((c) => c.embedding !== null);
  const results: SearchResult[] = [];
  const seenChunkIds = new Set<string>();

  // 1. Semantic search (if embeddings exist)
  if (embedded.length > 0) {
    const semantic = await semanticSearchFn(chunks, query, topK);
    for (const r of semantic) {
      if (!seenChunkIds.has(r.chunk.id)) {
        results.push(r);
        seenChunkIds.add(r.chunk.id);
      }
    }
  }

  // 2. BM25 keyword search
  const bm25 = await bm25Search(kbId, query, topK);
  for (const r of bm25) {
    if (!seenChunkIds.has(r.chunk.id)) {
      results.push({
        chunk: r.chunk,
        score: r.score / (Math.max(...bm25.map(b => b.score), 1)), // Normalize
        docName: r.doc.name,
        docType: r.doc.type,
      });
      seenChunkIds.add(r.chunk.id);
    }
  }

  // Sort merged results by score descending
  results.sort((a, b) => b.score - a.score);

  // 3. If nothing found, try full-text fallback
  if (results.length === 0) {
    const fallback = await fullTextSearch(kbId, query, topK);
    for (const r of fallback) {
      results.push({
        chunk: r.chunk,
        score: r.score,
        docName: r.doc.name,
        docType: r.doc.type,
      });
    }
  }

  return results.slice(0, topK);
}

// ── Legacy simple text search (kept for compat) ───

export async function textSearch(
  kbId: string,
  query: string,
  topK = 5,
): Promise<{ chunk: Chunk; doc: Document }[]> {
  return bm25Search(kbId, query, topK);
}
