import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { handler } = require('../dist/index.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..', '..');
const openApiSpec = readFileSync(resolve(projectRoot, 'openapi.yaml'), 'utf8');

const port = Number(process.env.PORT ?? 3000);

const swaggerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Event Registration API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" />
    <style>
      body { margin: 0; background: #f5f7fb; }
      #swagger-ui { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '/openapi.yaml',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
          layout: 'BaseLayout',
        });
      };
    </script>
  </body>
</html>`;

function normalizeHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : value ?? '']),
  );
}

function resolveResource(pathname) {
  if (pathname === '/health') return '/health';
  if (pathname === '/events') return '/events';
  if (pathname.startsWith('/events/')) {
    if (pathname.match(/^\/events\/[^/]+\/registrations$/)) return '/events/{id}/registrations';
    return '/events/{id}';
  }
  return pathname;
}

function extractPathParameters(pathname) {
  const eventMatch = pathname.match(/^\/events\/([^/]+)$/);
  if (eventMatch) return { id: eventMatch[1] };

  const registrationMatch = pathname.match(/^\/events\/([^/]+)\/registrations$/);
  if (registrationMatch) return { id: registrationMatch[1], eventId: registrationMatch[1] };

  return {};
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (requestUrl.pathname === '/docs' || requestUrl.pathname === '/swagger') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(swaggerHtml);
    return;
  }

  if (requestUrl.pathname === '/openapi.yaml') {
    res.writeHead(200, { 'Content-Type': 'application/yaml; charset=utf-8' });
    res.end(openApiSpec);
    return;
  }

  const body = ['GET', 'DELETE'].includes(req.method ?? '') ? undefined : await readBody(req);

  const event = {
    body: body || null,
    headers: normalizeHeaders(req.headers),
    httpMethod: req.method ?? 'GET',
    isBase64Encoded: false,
    path: requestUrl.pathname,
    pathParameters: extractPathParameters(requestUrl.pathname),
    queryStringParameters: Object.fromEntries(requestUrl.searchParams.entries()),
    multiValueHeaders: Object.fromEntries(
      Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value : [value ?? '']]),
    ),
    multiValueQueryStringParameters: Array.from(requestUrl.searchParams.entries()).reduce((acc, [key, value]) => {
      acc[key] = acc[key] ? [...acc[key], value] : [value];
      return acc;
    }, {}),
    resource: resolveResource(requestUrl.pathname),
    requestContext: {
      path: requestUrl.pathname,
      httpMethod: req.method ?? 'GET',
      requestId: 'local-request',
      stage: 'local',
      identity: {
        sourceIp: '127.0.0.1',
      },
    },
    stageVariables: null,
  };

  const response = await handler(event);

  res.writeHead(response.statusCode ?? 200, response.headers ?? {});
  res.end(response.body ?? '');
});

server.listen(port, () => {
  console.log(`Local backend listening on http://localhost:${port}`);
});
