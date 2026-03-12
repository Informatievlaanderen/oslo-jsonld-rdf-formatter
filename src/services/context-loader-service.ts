import type { ContextDefinition } from "jsonld";

export async function loadContext(
  contextRef: string,
): Promise<ContextDefinition> {
  const resp = await fetch(contextRef);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} fetching ${contextRef}`);
  }
  return resp.json();
}

export function extractContext(
  contextDoc: Record<string, unknown>,
): ContextDefinition {
  return (contextDoc["@context"] || contextDoc) as ContextDefinition;
}
