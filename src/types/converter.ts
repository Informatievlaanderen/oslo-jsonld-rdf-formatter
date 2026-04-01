export interface ConvertOptions {
  output?: string;
  root?: string;
  compact?: boolean;
}

export interface ContextMappings {
  scoped: ScopedMapping;
  fallback: Map<string, string>;
  arrayProps: Set<string>;
  propertyTypes: Map<string, string>;
  primitiveTypes: Set<string>;
  typeExpansions: Map<string, string>;
}

export type PropDef = { "@id": string; [key: string]: unknown };
export type TypeDef = { "@id": string; "@context"?: Record<string, PropDef> };
export type ScopedMapping = Map<string, Map<string, string>>; // termName → (propIRI → localName)
