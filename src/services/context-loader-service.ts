import fs from "fs";
import path from "path";
import type { ContextDefinition } from "jsonld";

export async function loadContext(
  contextRef: string,
): Promise<ContextDefinition> {
  if (/^https?:\/\//.test(contextRef)) {
    const resp = await fetch(contextRef);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} fetching ${contextRef}`);
    }
    return resp.json();
  }
  const abs = path.resolve(contextRef);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

export function extractContext(
  contextDoc: Record<string, unknown>,
): ContextDefinition {
  return (contextDoc["@context"] || contextDoc) as ContextDefinition;
}
