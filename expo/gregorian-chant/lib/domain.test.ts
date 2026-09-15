import { describe, expect, test } from "bun:test";
import { CHANTS } from "./catalog";
import { createPracticeLoop, searchChants } from "./domain";
import { gabcLatinText, parseGabc } from "./gabc";

describe("chant catalog", () => {
  test("searches liturgical metadata and text", () => {
    expect(searchChants(CHANTS, "marian").map((chant) => chant.id)).toEqual([
      "salve-regina-simplex",
      "ave-maria-antiphon",
    ]);
    expect(searchChants(CHANTS, "Christe")[0]?.id).toBe("kyrie-xi-vatican-1908");
    expect(searchChants(CHANTS, "kyriale")[0]?.id).toBe("kyrie-xi-vatican-1908");
  });

  test("keeps GABC as structured source authority", () => {
    const kyrie = CHANTS[0];
    expect(kyrie?.notation?.format).toBe("gabc");
    const document = parseGabc(kyrie?.notation?.source ?? "");
    expect(document.mode).toBe(1);
    expect(document.headers.name).toBe("Kyrie XI");
    expect(gabcLatinText(kyrie?.notation?.source ?? "")).toContain("eléison");
  });

  test("refuses loops until a recording has authoritative timings", () => {
    expect(createPracticeLoop(CHANTS[0]!, "kyrie-1", 0.75)).toBeNull();
  });
});
