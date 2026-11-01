import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

let catalogSequence = 0;
let pulseSequence = 0;

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Platform-Source', 'server');
  res.end(JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const catalog = url.pathname === '/api/catalog';
  const pulse = url.pathname === '/api/pulse';
  if (!catalog && !pulse) return false;
  const delay = Math.min(Number(url.searchParams.get('delay') || 0), 5000);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  const pulseKind = pulse || url.searchParams.get('kind') === 'pulse';
  if (url.searchParams.get('fail') === '1') {
    send(res, 503, { error: pulseKind ? 'The pulse request failed.' : 'The catalog request failed.' });
    return true;
  }
  if (url.pathname === '/api/pulse') {
    pulseSequence += 1;
    send(res, 200, { label: `pulse ${pulseSequence}`, sequence: pulseSequence, takenAt: Date.now(), servedBy: 'server' });
    return true;
  }
  if (pulseKind) {
    catalogSequence += 1;
    send(res, 200, { label: `pulse ${catalogSequence}`, sequence: catalogSequence, takenAt: Date.now(), servedBy: 'server' });
    return true;
  }
  send(res, 200, { label: url.searchParams.get('label') || 'record', servedBy: 'server' });
  return true;
}

function attach(middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => void) => void }) {
  middlewares.use((req, res, next) => {
    void handle(req, res).then((done) => {
      if (!done) next();
    }).catch(next);
  });
}

export function platformApi(): Plugin {
  return {
    name: 'platform-api',
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}
