import { createFileRoute } from '@tanstack/react-router';
import { runScraperPipeline } from '../../lib/scraper-pipeline';

// This server route handles HTTP calls to trigger the daily scraping pipeline
export const Route = createFileRoute('/api/scrape')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return handleRequest(request);
      },
      POST: async ({ request }) => {
        return handleRequest(request);
      }
    }
  }
});

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const tokenParam = url.searchParams.get('token');
  const tokenHeader = request.headers.get('x-cron-token');
  
  const token = tokenParam || tokenHeader;
  
  // Read expected secret from environment variables
  const secret = process.env.CRON_SECRET;
  
  // Allow token-less execution ONLY in development mode
  const isDev = process.env.NODE_ENV === 'development';
  
  if (!isDev) {
    if (!secret) {
      console.warn('[API/Scrape] Warning: CRON_SECRET is not configured in production environment variables. Blocking all scrape triggers.');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: CRON_SECRET is not configured on the server.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (token !== secret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid cron token.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } else {
    // In dev mode, if secret is defined, still require it
    if (secret && token !== secret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid cron token (secret configured in dev).' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
  
  console.log('[API/Scrape] Triggering daily scraping pipeline in the background...');
  
  // Trigger scraping in the background asynchronously so the client request returns immediately
  // This prevents HTTP gateway timeouts (typically 10-30s) as scraping takes ~30s to finish
  runScraperPipeline()
    .then(result => {
      if (result.success) {
        console.log(`[API/Scrape] Background scraping completed successfully. Saved ${result.count} products.`);
      } else {
        console.error(`[API/Scrape] Background scraping failed: ${result.error}`);
      }
    })
    .catch(err => {
      console.error('[API/Scrape] Unhandled exception in background scraping pipeline:', err);
    });
    
  return new Response(
    JSON.stringify({
      status: 'scraping_started',
      message: 'Daily grocery price scraping pipeline initiated in the background. Results will be visible in the dashboard upon completion.',
      triggeredAt: new Date().toISOString()
    }),
    {
      status: 202, // 202 Accepted
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    }
  );
}
