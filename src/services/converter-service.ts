import fs from "fs";
import * as jsonld from "jsonld";
import { loadContext, extractContext } from "./context-loader-service";
import { turtleToNQuads } from "./turtle-parser-service";
import {
  ConvertOptions,
  ContextMappings,
  ScopedMapping,
  TypeDef,
} from "../types/converter";
import {
  applyScoped,
  collapsePrimitiveLiterals,
  enforceArrayProps,
  expandPrimitiveLiterals,
} from "../utils/converter-utils";

function isContainerArray(container: unknown): boolean {
  if (container === "@set" || container === "@list") return true;
  if (Array.isArray(container))
    return container.includes("@set") || container.includes("@list");
  return false;
}

function buildMappings(ctx: Record<string, unknown>): ContextMappings {
  const scoped: ScopedMapping = new Map();
  const fallback = new Map<string, string>();
  const arrayProps = new Set<string>();
  const propertyTypes = new Map<string, string>();
  const primitiveTypes = new Set<string>();
  const typeExpansions = new Map<string, string>();
  const stringLikeTypes = new Set<string>();

  for (const [termName, typeDef] of Object.entries(ctx)) {
    if (typeof typeDef !== "object" || typeDef === null) continue;

    const entry = typeDef as Record<string, unknown>;
    const id = entry["@id"];
    const hasContext = "@context" in entry;

    // Collect primitive type aliases: top-level entries with @id but no @context
    // (e.g. "String", "Date", "Integer", "LangString", "Literal", "URI", etc.)
    if (typeof id === "string" && !hasContext) {
      primitiveTypes.add(termName);
      primitiveTypes.add(id);
      typeExpansions.set(termName, id);

      // Track string-like types (String, LangString) where @type can be omitted
      if (
        termName === "String" ||
        termName === "LangString" ||
        id.endsWith("#string") ||
        id.endsWith("#langString")
      ) {
        stringLikeTypes.add(termName);
        stringLikeTypes.add(id);
      }
    }

    // Collect top-level array properties
    if ("@container" in entry && isContainerArray(entry["@container"])) {
      arrayProps.add(termName);
    }

    if (!hasContext) continue;

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
        // Collect scoped array properties
        if (isContainerArray(propDef["@container"])) {
          arrayProps.add(localName);
        }
        // Collect property types (first definition wins)
        if (propDef["@type"] && !propertyTypes.has(localName)) {
          propertyTypes.set(localName, propDef["@type"] as string);
        }
      }
    }

    if (iriToLocal.size > 0) {
      scoped.set(termName, iriToLocal);
    }
  }

  return {
    scoped,
    fallback,
    arrayProps,
    propertyTypes,
    primitiveTypes,
    typeExpansions,
    stringLikeTypes,
  };
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
  const ctx = extractContext(contextDoc);
  let root;

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

  const {
    scoped,
    fallback,
    arrayProps,
    propertyTypes,
    primitiveTypes,
    typeExpansions,
    stringLikeTypes,
  } = buildMappings(ctx as Record<string, unknown>);
  const unmappedUris = new Set<string>();
  root = applyScoped(root, scoped, fallback, unmappedUris) as typeof root;
  root = enforceArrayProps(root, arrayProps) as typeof root;

  if (opts.compact) {
    root = collapsePrimitiveLiterals(root, primitiveTypes) as typeof root;
  } else {
    root = expandPrimitiveLiterals(
      root,
      propertyTypes,
      typeExpansions,
      stringLikeTypes,
    ) as typeof root;
  }

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
