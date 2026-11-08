import { resolveSituation } from '../situations.js';
import type { ToolHandler } from './types.js';

const PLANS = ['full', '3_payments', '6_payments'] as const;
// The test account's minimum; a real server would read it from the verified account.
const MIN_MONTHLY_PAYMENT = 50;

/**
 * record_agreement: records the plan the caller agreed and resolves `negotiation`. A refusal leaves the situation
 * active, so the agent can keep negotiating.
 */
export const recordAgreement: ToolHandler = (args) => {
  const plan = String(args.plan ?? '');
  const monthly = Number(args.monthly_amount);
  if (!(PLANS as readonly string[]).includes(plan)) {
    return { recorded: false, message: `Plan must be one of ${PLANS.join(', ')}.` };
  }
  if (plan !== 'full' && !(monthly >= MIN_MONTHLY_PAYMENT)) {
    return { recorded: false, message: `The monthly amount must be at least ${MIN_MONTHLY_PAYMENT}.` };
  }
  return {
    recorded: true,
    reference: `AGR-${Date.now().toString(36).toUpperCase()}`,
    plan,
    ...(plan === 'full' ? {} : { monthly_amount: monthly }),
    ...resolveSituation('negotiation'),
  };
};
