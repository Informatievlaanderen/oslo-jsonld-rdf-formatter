#!/usr/bin/env node

import { program } from "commander";
import { convert } from "./services/converter-service";
import { ConvertOptions } from "./types/converter";

program
  .name("jsonld-rdf-formatter")
  .description("Convert an RDF Turtle file to JSON-LD using a provided context")
  .version("1.0.0")
  .argument("<ttl-file>", "Path to the input .ttl file")
  .argument("<context>", "Path or URL to a JSON-LD context file")
  .option("-o, --output <file>", "Output file (default: <ttl-file>.jsonld)")
  .action(
    async (ttlFile: string, contextFile: string, opts: ConvertOptions) => {
      try {
        await convert(ttlFile, contextFile, opts);
      } catch (err) {
        console.error("Error:", err instanceof Error ? err.message : err);
        process.exit(1);
      }
    },
  );

program.parse();
