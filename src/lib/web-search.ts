// ── Web Search ────────────────────────────────────
// Multi-tier fallback: Vite proxy (dev) → DuckDuckGo Lite → wttr.in weather

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface FetchPageResult {
  content: string;
  error?: string;
}

// ── Helpers ──────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&ensp;/g, ' ')
    .replace(/&#0*183;/g, '·')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWithTimeout(url: string, timeoutMs = 8000, headers: Record<string, string> = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'text/html,application/json,*/*', ...headers },
    });
  } finally {
    clearTimeout(timer);
  }
}

function isTimeSensitiveQuery(query: string): boolean {
  const patterns = [
    /天气|weather/i,
    /今日|今天|now|today|本周|今年/i,
    /实时|最新|current|latest/i,
    /温度|气温|temperature/i,
    /预报|forecast/i,
    /分数线|录取|招生|分数|成绩/i,
    /政策|规定|通知|公告/i,
    /价格|股价|汇率|排名/i,
  ];
  return patterns.some((p) => p.test(query));
}

// ── Weather (wttr.in, CORS-friendly) ──────────────

async function fetchWeatherFromWttr(query: string): Promise<string> {
  try {
    const cityMatch = query.match(/([\u4e00-\u9fa5]{2,}(?:市|省|区)?)/);
    const city = cityMatch?.[1] || 'Beijing';
    const resp = await fetchWithTimeout(`https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=zh`, 6000);
    if (!resp.ok) return '';
    const data = await resp.json();
    const current = data.current_condition?.[0];
    if (!current) return '';
    const today = data.weather?.[0];
    return [
      `城市: ${city}`,
      `当前温度: ${current.temp_C}°C（体感 ${current.FeelsLikeC}°C）`,
      `天气: ${current.lang_zh?.[0]?.value || current.weatherDesc?.[0]?.value || '未知'}`,
      `湿度: ${current.humidity}%`,
      `风向风速: ${current.winddir16Point} ${current.windspeedKmph} km/h`,
      today ? `今日最高: ${today.maxtempC}°C, 最低: ${today.mintempC}°C` : '',
      `更新时间: ${current.observation_time}`,
    ].filter(Boolean).join('\n');
  } catch {
    return '';
  }
}

// ── Tier 1: Vite Dev Proxy (Bing) ─────────────────

async function searchViaBingProxy(query: string, maxResults = 5): Promise<WebSearchResult[]> {
  try {
    const searchUrl = `/api/search?q=${encodeURIComponent(query)}&count=${maxResults}&setlang=zh-cn`;
    const resp = await fetchWithTimeout(searchUrl, 8000);
    const html = await resp.text();

    const results: WebSearchResult[] = [];
    const blockRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    while ((match = blockRegex.exec(html)) !== null && results.length < maxResults) {
      const block = match[1];
      const urlM = block.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>/);
      const titleM = block.match(/<a[^>]*>([\s\S]*?)<\/a>/);
      const snippetM = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);

      if (urlM && titleM) {
        const title = stripHtml(titleM[1]);
        const snippet = snippetM?.[1] ? stripHtml(snippetM[1]) : '';
        if (title && !urlM[1].includes('bing.com') && !urlM[1].includes('microsoft.com/bing')) {
          results.push({ title, url: urlM[1], snippet: snippet || title });
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ── Tier 2: DuckDuckGo HTML API (no CORS) ──

async function searchViaDDG(query: string, maxResults = 5): Promise<WebSearchResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const resp = await fetchWithTimeout(url, 8000);
    if (!resp.ok) return [];
    const html = await resp.text();

    const results: WebSearchResult[] = [];
    // DDG HTML API uses class="result" divs
    const resultRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
      const url = match[1];
      const title = stripHtml(match[2]);
      const snippet = stripHtml(match[3] || '');
      if (title && url && !url.includes('duckduckgo.com')) {
        results.push({ title, url, snippet: snippet || title });
      }
    }

    // Fallback regex if DDG changed layout
    if (results.length === 0) {
      const linkRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
      const links = [...html.matchAll(linkRegex)];
      const snippets = [...html.matchAll(snippetRegex)];
      for (let i = 0; i < Math.min(links.length, snippets.length, maxResults); i++) {
        const url = links[i][1];
        const title = stripHtml(links[i][2]);
        const snip = stripHtml(snippets[i]?.[1] || '');
        if (title && url && !url.includes('duckduckgo.com')) {
          results.push({ title, url, snippet: snip || title });
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

// ── Tier 3: Fetch page content ────────────────────

async function fetchPageContent(url: string, timeoutMs = 8000): Promise<FetchPageResult> {
  try {
    // Try Vite proxy first (dev)
    const proxyUrl = `/fetch-page-proxy?url=${encodeURIComponent(url)}`;
    const resp = await fetchWithTimeout(proxyUrl, timeoutMs);
    if (resp.ok) {
      const html = await resp.text();
      return { content: stripHtml(html).slice(0, 5000) };
    }
  } catch {
    // Proxy not available, try direct fetch
  }

  try {
    const resp = await fetchWithTimeout(url, timeoutMs);
    if (resp.ok) {
      const html = await resp.text();
      return { content: stripHtml(html).slice(0, 5000) };
    }
    return { content: '', error: `HTTP ${resp.status}` };
  } catch (e) {
    return { content: '', error: String(e) };
  }
}

// ── Main webSearch ────────────────────────────────

export async function webSearch(
  query: string,
  maxResults = 5,
): Promise<WebSearchResult[]> {
  // Try multiple search backends in parallel, take first that returns results
  const [bingResults, ddgResults] = await Promise.all([
    searchViaBingProxy(query, maxResults),
    searchViaDDG(query, maxResults),
  ]);

  // Prefer Bing (better quality), fall back to DDG
  let results = bingResults.length > 0 ? bingResults : ddgResults;

  // Weather: always inject wttr.in data
  if (/天气|weather/i.test(query)) {
    const weatherData = await fetchWeatherFromWttr(query);
    if (weatherData) {
      results.unshift({
        title: '实时天气数据 (wttr.in)',
        url: 'https://wttr.in',
        snippet: weatherData,
      });
    }
    return results.slice(0, maxResults);
  }

  // Time-sensitive queries: enrich with page content
  if (isTimeSensitiveQuery(query) && results.length > 0) {
    const pagePromises = results.slice(0, 3).map(async (r, i) => {
      try {
        const page = await fetchPageContent(r.url, 8000);
        if (page.content && !page.error) {
          results[i] = { ...results[i], snippet: page.content };
        }
      } catch { /* keep original snippet */ }
    });
    await Promise.allSettled(pagePromises.slice(0, 2));
  }

  return results.slice(0, maxResults);
}

// ── Format results for LLM context ────────────────

export function formatWebSearchContext(
  results: WebSearchResult[],
  locale: 'zh' | 'en',
): string {
  if (results.length === 0) {
    return locale === 'zh'
      ? '（网络搜索暂时不可用，请检查网络连接。提示：在开发环境下运行 `npm run dev` 可启用 Bing 搜索代理。）'
      : '(Web search temporarily unavailable. Check your network. Tip: run `npm run dev` to enable Bing search proxy.)';
  }
  return results
    .map((r, i) => `[Web ${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
    .join('\n\n');
}
