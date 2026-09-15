import type { GregorianMode } from "./domain";

export interface GabcDocument {
  headers: Readonly<Record<string, string>>;
  body: string;
  mode?: GregorianMode;
}

export function parseGabc(source: string): GabcDocument {
  const separator = source.indexOf("%%");
  if (separator < 0) {
    throw new Error("GABC source must contain a %% header separator");
  }

  const headers: Record<string, string> = {};
  for (const field of source.slice(0, separator).split(";")) {
    const trimmed = field.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    headers[trimmed.slice(0, colon).trim()] = trimmed.slice(colon + 1).trim();
  }

  const parsedMode = Number(headers.mode);
  const mode =
    Number.isInteger(parsedMode) && parsedMode >= 1 && parsedMode <= 8
      ? (parsedMode as GregorianMode)
      : undefined;

  const body = source.slice(separator + 2).trim();
  if (!body) throw new Error("GABC source must contain chant notation");

  return { headers, body, mode };
}

export function gabcLatinText(source: string): string {
  const { body } = parseGabc(source);
  return body
    .replace(/\([^)]*\)/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[!*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
