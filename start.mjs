// Optional alternative to Python. Node 18+; no npm install or build step.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, resolve, sep } from 'node:path';
const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Use: node start.mjs [port], for example node start.mjs 5173');
  process.exit(1);
}
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.py': 'text/plain; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, 'http://127.0.0.1').pathname,
    );
    const path = resolve(
      root,
      '.' + (pathname === '/' ? '/index.html' : pathname),
    );
    if (!path.startsWith(root + sep)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, {
        Allow: 'GET, HEAD',
      });
      response.end();
      return;
    }
    const content = await readFile(path);
    response.writeHead(200, {
      'Content-Type': mime[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
server.on('error', (error) => {
  console.error(
    `Could not start the app: ${error.message}\nClose any other copy of the server, or use node start.mjs 5174.`,
  );
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () =>
  console.log(
    `\nThe Cage — Session desk\nOpen http://127.0.0.1:${port}\nKeep this window open. Press Ctrl+C to stop.\n`,
  ),
);
