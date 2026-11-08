export type Json = Record<string, unknown>;

/** A tool: Agent Studio POSTs the model's arguments as JSON; the returned object is the tool's result. */
export type ToolHandler = (args: Json) => Json;
