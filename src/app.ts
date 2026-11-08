import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import type { Logger } from 'pino';
import type { Config } from './config.js';
import { verifySignature } from './signature.js';
import { TOOLS } from './tools/index.js';
import type { Json } from './tools/types.js';

const MAX_BODY_BYTES = 64 * 1024;

function send(res: ServerResponse, status: number, body: Json): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        resolve(null);
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * The request handler: POST /<tool name> runs that tool. When the tool has a signing secret configured, the request
 * must carry a valid X-Studio-Signature; the raw body is what was signed, so it is read before parsing.
 */
export function createApp(config: Config, log: Logger): RequestListener {
  return async (req, res) => {
    const url = req.url ?? '/';
    const tool = url.split('?')[0]!.slice(1);
    // At debug level, every response is logged as sent, after the request it answers.
    const reply = (status: number, body: Json): void => {
      log.debug({ method: req.method, url, status, body }, 'sent');
      send(res, status, body);
    };
    const handler = req.method === 'POST' ? TOOLS.get(tool) : undefined;
    if (!handler) {
      log.debug({ method: req.method, url }, 'received');
      return reply(404, { error: 'not found' });
    }

    const raw = await readBody(req).catch(() => null);
    log.debug(
      { method: req.method, url, signature: req.headers['x-studio-signature'] ?? null, body: raw },
      'received',
    );
    if (raw === null) return reply(413, { error: 'body too large' });

    const secret = config.secrets[tool];
    if (
      secret &&
      !verifySignature(secret, req.headers['x-studio-signature'] as string | undefined, 'POST', url, raw)
    ) {
      log.warn({ tool }, 'rejected: bad or missing X-Studio-Signature');
      return reply(401, { error: 'bad signature' });
    }

    let args: Json;
    try {
      args = raw ? (JSON.parse(raw) as Json) : {};
    } catch {
      return reply(400, { error: 'body is not JSON' });
    }

    const result = handler(args);
    // The caller's details stay out of the log; the outcome and any situation change go in.
    log.info({ tool, ok: result.verified ?? result.recorded, actions: result.actions }, 'tool call');
    reply(200, result);
  };
}
