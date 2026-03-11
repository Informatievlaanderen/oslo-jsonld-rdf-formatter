import fs from "fs";
import * as jsonld from "jsonld";
import { loadContext, extractContext } from "./context-loader-service";
import { turtleToNQuads } from "./turtle-parser-service";
import { ConvertOptions } from "../types/converter";

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

  if (opts.root) {
    const frame = {
      "@context": ctx,
      "@embed": "@once",
      "@type": opts.root,
    };
    root = await jsonld.frame(root, frame);
  }

  // Replace the inline context with a URL reference
  root["@context"] = contextFile;

  // Keep same name as input file, just with jsonld extension
  const output = opts.output || ttlFile.replace(/\.ttl$/i, ".jsonld");
  fs.writeFileSync(output, JSON.stringify(root, null, 2));
  console.log(`Written to ${output}`);
}
