/**
 * A customer's server for Agent Studio situations: the HTTP tools a collections agent calls, which start and resolve
 * situations through their results. See README.md.
 */
import { createServer } from 'node:http';
import { pino } from 'pino';
import { createApp } from './app.js';
import { loadConfig, secretEnvName } from './config.js';
import { TOOLS } from './tools/index.js';

const log = pino({ name: 'situations-server' });
const config = loadConfig();

const unverified = Object.keys(TOOLS).filter((t) => !config.secrets[t]);
if (unverified.length > 0) {
  log.warn(
    { tools: unverified, set: unverified.map(secretEnvName) },
    'requests to these tools are not verified; set their signing secrets for anything but a first try',
  );
}

const server = createServer(createApp(config, log));
server.listen(config.port, () => log.info({ port: config.port }, 'situations example server listening'));

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
