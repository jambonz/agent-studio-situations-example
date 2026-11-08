/**
 * The two situation changes a tool's result can carry. Agent Studio reads `actions` from the JSON result, applies
 * the change before the model sees the result, and removes `actions` from what the model sees.
 */
export type SituationAction = { situation: string } | { resolve_situation: string };

/** Start a situation: its instructions and tools apply from the agent's next turn. */
export const startSituation = (name: string): { actions: SituationAction } => ({
  actions: { situation: name },
});

/** Resolve a situation: its instructions and tools are removed. The call carries on. */
export const resolveSituation = (name: string): { actions: SituationAction } => ({
  actions: { resolve_situation: name },
});
