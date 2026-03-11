import fs from "fs";
import path from "path";
import { Parser, Writer } from "n3";

export function turtleToNQuads(ttlPath: string): Promise<string> {
  const ttl = fs.readFileSync(path.resolve(ttlPath), "utf8");
  return new Promise((resolve, reject) => {
    const parser = new Parser();
    const writer = new Writer({ format: "N-Quads" });

    parser.parse(ttl, (err, quad) => {
      if (err) {
        // Log the error to the CLI user
        console.error(err);
        return reject(err);
      }

      if (quad) {
        writer.addQuad(quad);
      } else {
        writer.end((err2, nquads) => (err2 ? reject(err2) : resolve(nquads)));
      }
    });
  });
}
