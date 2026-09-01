import { createServer } from 'node:http';
import { existsSync, statSync, createReadStream } from 'node:fs';
import { extname, resolve, sep } from 'node:path';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function sendStatus(response, statusCode, message) {
  response.writeHead(statusCode, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(message);
}

export async function startQaServer(rootDirectory) {
  const root = resolve(rootDirectory);
  const rootPrefix = `${root}${sep}`;
  const server = createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method ?? '')) {
      sendStatus(response, 405, 'Method Not Allowed');
      return;
    }

    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    let pathname;
    try {
      pathname = decodeURIComponent(requestUrl.pathname);
    } catch {
      sendStatus(response, 400, 'Bad Request');
      return;
    }

    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = resolve(root, relativePath);
    if (filePath !== root && !filePath.startsWith(rootPrefix)) {
      sendStatus(response, 403, 'Forbidden');
      return;
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      sendStatus(response, 404, 'Not Found');
      return;
    }

    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  });

  await new Promise((resolveServer, rejectServer) => {
    server.once('error', rejectServer);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectServer);
      resolveServer();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise((resolveClose, rejectClose) => server.close(error => error ? rejectClose(error) : resolveClose()));
    throw new Error('QA server did not receive a TCP port');
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolveClose, rejectClose) => server.close(error => error ? rejectClose(error) : resolveClose()))
  };
}
