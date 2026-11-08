import { findAccount } from '../accounts.js';
import { startSituation } from '../situations.js';
import type { ToolHandler } from './types.js';

/**
 * verify_identity: checks the caller against the account. On a match it starts `negotiation`, an "Only your server"
 * situation: until now the agent has neither its instructions nor its record_agreement tool, so it cannot discuss
 * the debt with someone who hasn't been verified.
 */
export const verifyIdentity: ToolHandler = (args) => {
  const last4 = String(args.account_last4 ?? '').replace(/\D/g, '');
  const zip = String(args.zip ?? '').trim();
  const account = findAccount(last4, zip);
  if (!account) return { verified: false, message: "Those details don't match our records." };
  return {
    verified: true,
    customer_name: account.name,
    balance: account.balance,
    min_monthly_payment: account.minMonthlyPayment,
    ...startSituation('negotiation'),
  };
};
