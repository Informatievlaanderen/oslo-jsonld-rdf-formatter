import { SKIP_RECURSE } from "../constants/constants";
import { ScopedMapping } from "../types/converter";

export function enforceArrayProps(
  obj: unknown,
  arrayProps: Set<string>,
): unknown {
  if (Array.isArray(obj))
    return obj.map((item) => enforceArrayProps(item, arrayProps));
  if (typeof obj !== "object" || obj === null) return obj;

  const node = obj as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    const processed = SKIP_RECURSE.has(key)
      ? value
      : enforceArrayProps(value, arrayProps);
    result[key] =
      arrayProps.has(key) && !Array.isArray(processed)
        ? [processed]
        : processed;
  }
  return result;
}

function isUri(str: string): boolean {
  return /^https?:\/\//.test(str) || str.includes(":");
}

export function applyScoped(
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

export function collapsePrimitiveLiterals(
  obj: unknown,
  primitiveTypes: Set<string>,
): unknown {
  if (Array.isArray(obj))
    return obj.map((item) => collapsePrimitiveLiterals(item, primitiveTypes));
  if (typeof obj !== "object" || obj === null) return obj;

  const node = obj as Record<string, unknown>;
  const keys = Object.keys(node);

  // Collapse {"@type": "xsd:...", "@value": "..."} to just the value
  if (keys.length === 2 && primitiveTypes.has(node["@type"] as string)) {
    return node["@value"];
  }

  // Collapse {"@id": "..."} to just the URI string
  if (keys.length === 1 && typeof node["@id"] === "string") {
    return node["@id"];
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    result[key] = SKIP_RECURSE.has(key)
      ? value
      : collapsePrimitiveLiterals(value, primitiveTypes);
  }
  return result;
}

export function expandPrimitiveLiterals(
  obj: unknown,
  propertyTypes: Map<string, string>,
  typeExpansions?: Map<string, string>,
  stringLikeTypes?: Set<string>,
  parentKey?: string,
): unknown {
  if (Array.isArray(obj))
    return obj.map((item) =>
      expandPrimitiveLiterals(
        item,
        propertyTypes,
        typeExpansions,
        stringLikeTypes,
        parentKey,
      ),
    );
  if (typeof obj !== "object" || obj === null) {
    if (typeof obj === "string" && parentKey) {
      const type = propertyTypes.get(parentKey);
      // For string-like types (String, LangString), omit the @type field
      if (type && stringLikeTypes?.has(type)) {
        return { "@value": obj };
      }
      return type ? { "@type": type, "@value": obj } : { "@value": obj };
    }
    return obj;
  }

  const node = obj as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (SKIP_RECURSE.has(key)) {
      // Expand @type values if they're compacted type aliases
      if (key === "@type" && typeExpansions && typeof value === "string") {
        result[key] = typeExpansions.get(value) ?? value;
      } else {
        result[key] = value;
      }
    } else {
      result[key] = expandPrimitiveLiterals(
        value,
        propertyTypes,
        typeExpansions,
        stringLikeTypes,
        key,
      );
    }
  }
  return result;
}
