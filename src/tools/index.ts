import { recordAgreement } from './record-agreement.js';
import type { ToolHandler } from './types.js';
import { verifyIdentity } from './verify-identity.js';

/** Tool name to handler. Each is served at POST /<name>, the URL its Studio tool points at. */
export const TOOLS: Record<string, ToolHandler> = {
  verify_identity: verifyIdentity,
  record_agreement: recordAgreement,
};
