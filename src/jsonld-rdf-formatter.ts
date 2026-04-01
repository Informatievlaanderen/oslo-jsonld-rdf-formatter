#!/usr/bin/env node

import path from "path";
import { program } from "commander";
import { convert } from "./services/converter-service";
import { ConvertOptions } from "./types/converter";

program
  .name("jsonld-rdf-formatter")
  .description("Convert an RDF Turtle file to JSON-LD using a provided context")
  .argument("<ttl-file>", "Path to the input .ttl file")
  .argument("<context>", "URL to a JSON-LD context file")
  .option("-o, --output <file>", "Output file (default: <ttl-file>.jsonld)")
  .option("-r, --root <root>", "Root object for which to generate the JSON-LD")
  .option(
    "-c, --compact <value>",
    "Whether to compact the JSON-LD output (true/false)",
    (val) => val === "true",
    false,
  )
  .action(
    async (ttlFile: string, contextFile: string, opts: ConvertOptions) => {
      // Resolve paths relative to the current working directory
      const resolvedTtlFile = path.resolve(process.cwd(), ttlFile);
      const resolvedOutput = opts.output
        ? path.resolve(process.cwd(), opts.output)
        : undefined;
      const resolvedOpts: ConvertOptions = {
        ...opts,
        output: resolvedOutput,
      };

      try {
        await convert(resolvedTtlFile, contextFile, resolvedOpts);
      } catch (err) {
        console.error("Error:", err instanceof Error ? err.message : err);
        process.exit(1);
      }
    },
  );

program.parse();
