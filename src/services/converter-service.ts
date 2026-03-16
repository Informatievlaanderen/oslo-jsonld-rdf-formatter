import fs from "fs";
import * as jsonld from "jsonld";
import { loadContext, extractContext } from "./context-loader-service";
import { turtleToNQuads } from "./turtle-parser-service";
import { ConvertOptions, ScopedMapping, TypeDef } from "../types/converter";
import { SKIP_RECURSE } from "../constants/constants";

function buildMappings(ctx: Record<string, unknown>): {
  scoped: ScopedMapping;
  fallback: Map<string, string>;
} {
  const scoped: ScopedMapping = new Map();
  const fallback = new Map<string, string>();

  for (const [termName, typeDef] of Object.entries(ctx)) {
    if (
      typeof typeDef !== "object" ||
      typeDef === null ||
      !("@id" in typeDef) ||
      !("@context" in typeDef)
    )
      continue;

    const { "@context": scopedCtx } = typeDef as TypeDef;
    if (!scopedCtx) continue;

    const iriToLocal = new Map<string, string>();
    for (const [localName, propDef] of Object.entries(scopedCtx)) {
      if (typeof propDef === "object" && propDef !== null && propDef["@id"]) {
        iriToLocal.set(propDef["@id"], localName);
        // Fallback: first definition wins (no overwrite on conflict)
        if (!fallback.has(propDef["@id"])) {
          fallback.set(propDef["@id"], localName);
        }
      }
    }

    if (iriToLocal.size > 0) {
      scoped.set(termName, iriToLocal);
    }
  }

  return { scoped, fallback };
}

function isUri(str: string): boolean {
  return /^https?:\/\//.test(str) || str.includes(":");
}

function applyScoped(
  obj: unknown,
  scoped: ScopedMapping,
  fallback: Map<string, string>,
  unmappedUris: Set<string>,
): unknown {
  if (Array.isArray(obj))
    return obj.map((item) => applyScoped(item, scoped, fallback, unmappedUris));
  if (typeof obj !== "object" || obj === null) return obj;

  const node = obj as Record<string, unknown>;

  const iriToLocal = new Map<string, string>();
  const types = Array.isArray(node["@type"])
    ? node["@type"]
    : node["@type"]
      ? [node["@type"]]
      : [];
  for (const t of types as string[]) {
    const m = scoped.get(t);
    if (m) m.forEach((local, iri) => iriToLocal.set(iri, local));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    const mappedKey = iriToLocal.get(key) ?? fallback.get(key);
    const newKey = mappedKey ?? key;

    // Track unmapped URIs only (keys that didn't get shortened and look like URIs)
    if (!mappedKey && !SKIP_RECURSE.has(key) && isUri(key)) {
      unmappedUris.add(key);
    }

    // Recurse into @graph/@included but not into leaf @-keywords. Needed for the graph representation
    result[newKey] = SKIP_RECURSE.has(key)
      ? value
      : applyScoped(value, scoped, fallback, unmappedUris);
  }

  return result;
}

export async function convert(
  ttlFile: string,
  contextFile: string,
  opts: ConvertOptions,
): Promise<void> {
  const contextDoc = (await loadContext(contextFile)) as Record<
    string,
    unknown
  >;
  let root;
  const ctx = extractContext(contextDoc);

  console.log("Parsing Turtle…");
  const nquads = await turtleToNQuads(ttlFile);

  console.log("Converting to expanded JSON-LD…");
  const expanded = await jsonld.fromRDF(
    nquads as unknown as jsonld.JsonLdDocument,
    { format: "application/n-quads" },
  );

  console.log("Compacting with provided context…");
  root = await jsonld.compact(expanded as jsonld.JsonLdDocument, ctx);

  // Set the root object equal to the one passed via CLI. If none present, fallback to graph
  if (opts.root) {
    const frame = {
      "@context": ctx,
      "@embed": "@once",
      "@type": opts.root,
    };
    root = await jsonld.frame(root, frame);
  }

  const { scoped, fallback } = buildMappings(ctx as Record<string, unknown>);
  const unmappedUris = new Set<string>();
  root = applyScoped(root, scoped, fallback, unmappedUris) as typeof root;

  // Log unmapped URIs
  if (unmappedUris.size) {
    console.log("\nWarning: The following URIs could not be shortened:");
    Array.from(unmappedUris)
      .sort()
      .forEach((uri) => console.log(`  - ${uri}`));
  }

  root["@context"] = contextFile;

  const output = opts.output || ttlFile.replace(/\.ttl$/i, ".jsonld");
  fs.writeFileSync(output, JSON.stringify(root, null, 2));
  console.log(`Written to ${output}`);
}
