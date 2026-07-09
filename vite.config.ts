import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { IncomingMessage, ServerResponse } from 'http';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';

/**
 * Dev-only proxy for fetching web pages (CORS bypass).
 * In production, DuckDuckGo fallback handles search, and direct fetch works for CORS-friendly pages.
 */
function devFetchProxyPlugin(): Plugin {
  return {
    name: 'fetch-page-proxy',
    configureServer(server) {
      const handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith('/fetch-page-proxy')) return next();
        const q = new URL(req.url, 'http://localhost').searchParams;
        const u = q.get('url');
        if (!u) { res.statusCode = 400; res.end('Missing url'); return; }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');

        const urlObj = new URL(u);
        const client = u.startsWith('https') ? httpsRequest : httpRequest;
        const timeout = setTimeout(() => {
          proxyReq.destroy();
          res.statusCode = 504;
          res.end('Request timeout');
        }, 8000);

        const proxyReq = client({
          hostname: urlObj.hostname,
          port: urlObj.port || (u.startsWith('https') ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: req.method,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Host': urlObj.hostname,
          },
        }, (proxyRes) => {
          clearTimeout(timeout);
          let body = '';
          proxyRes.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          proxyRes.on('end', () => {
            res.statusCode = proxyRes.statusCode || 200;
            res.end(body);
          });
        });
        proxyReq.on('error', () => {
          clearTimeout(timeout);
          if (!res.headersSent) { res.statusCode = 502; res.end('Proxy error'); }
        });
        proxyReq.end();
      };

      // Insert at the front of the middleware stack
      server.middlewares.stack.unshift({
        route: '',
        handle: handler,
      } as any);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'NotebookLM - Local AI Knowledge Base',
        short_name: 'NotebookLM',
        description: 'Your private, local-first AI knowledge base. Upload documents, ask questions, all in your browser.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,onnx}'],
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
      },
    }),
    devFetchProxyPlugin(),
  ],
  optimizeDeps: {
    exclude: ['@xenova/transformers'],
  },
  build: {
    target: 'es2023',
    rollupOptions: {
      // Manual chunks for better caching
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/lucide-react/') || id.includes('node_modules/zustand/') || id.includes('node_modules/dexie/')) {
            return 'vendor-ui';
          }
          if (id.includes('node_modules/pdfjs-dist/')) {
            return 'vendor-pdf';
          }
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
});
