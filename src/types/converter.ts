export interface ConvertOptions {
  output?: string;
  root?: string;
}

export type PropDef = { "@id": string; [key: string]: unknown };
export type TypeDef = { "@id": string; "@context"?: Record<string, PropDef> };
export type ScopedMapping = Map<string, Map<string, string>>; // termName → (propIRI → localName)
