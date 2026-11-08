import { TOOLS } from './tools/index.js';

export interface Config {
  port: number;
  /** Signing secret per tool name. A tool with none is not verified (fine for a first try, not for production). */
  secrets: Record<string, string>;
}

/** The env variable holding a tool's signing secret: verify_identity -> STUDIO_SIGNING_SECRET_VERIFY_IDENTITY. */
export const secretEnvName = (tool: string): string => `STUDIO_SIGNING_SECRET_${tool.toUpperCase()}`;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const secrets: Record<string, string> = {};
  for (const tool of Object.keys(TOOLS)) {
    const s = env[secretEnvName(tool)];
    if (s) secrets[tool] = s;
  }
  return { port: Number(env.PORT ?? 3100), secrets };
}
