import { recordAgreement } from './record-agreement.js';
import type { ToolHandler } from './types.js';
import { verifyIdentity } from './verify-identity.js';

/**
 * Tool name to handler. Each is served at POST /<name>, the URL its Studio tool points at.
 * A Map, not a plain object, so a path like /constructor can't reach an inherited method.
 */
export const TOOLS = new Map<string, ToolHandler>([
  ['verify_identity', verifyIdentity],
  ['record_agreement', recordAgreement],
]);
