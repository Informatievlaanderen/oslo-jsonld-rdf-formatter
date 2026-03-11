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
  const ctx = extractContext(contextDoc);

  console.error("Parsing Turtle…");
  const nquads = await turtleToNQuads(ttlFile);

  console.error("Converting to expanded JSON-LD…");
  const expanded = await jsonld.fromRDF(
    nquads as unknown as jsonld.JsonLdDocument,
    { format: "application/n-quads" },
  );

  console.error("Compacting with provided context…");
  const compacted = await jsonld.compact(
    expanded as jsonld.JsonLdDocument,
    ctx,
  );

  // Keep same name as input file, just with jsonld extension
  const output = opts.output || ttlFile.replace(/\.ttl$/i, ".jsonld");
  fs.writeFileSync(output, JSON.stringify(compacted, null, 2));
  console.error(`Written to ${output}`);
}
