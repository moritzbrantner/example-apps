import { describe, expect, test } from "bun:test";
import { normalizeNotationWidth } from "./notation";

describe("notation renderer contract", () => {
  test("keeps layout widths finite and bounded across hosts", () => {
    expect(normalizeNotationWidth(Number.NaN)).toBe(280);
    expect(normalizeNotationWidth(120)).toBe(280);
    expect(normalizeNotationWidth(639.6)).toBe(640);
    expect(normalizeNotationWidth(1600)).toBe(1200);
  });
});
