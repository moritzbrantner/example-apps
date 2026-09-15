import type { Chant } from "./domain";

const KYRIE_XI_GABC = `name:Kyrie XI;
office-part:Kyriale;
mode:1;
book:Graduale Romanum, 1908, p. 35*;
%%
(c4) K y(ixhi)ri(hg)e(hd) *(,) e(ixfgh!ivHGfvED)lé(c)i(d)son.(d) iij.(::)
Chri(hg)ste(kvjkJHGh) (,) e(ixfgh!ivHGfvED)lé(c)i(d)son.(d) iij.(::)
Ký(ixhi)ri(hg)e(hd) (,) e(ixfgh!ivHGfvED)lé(c)i(d)son.(d) ij.(::)
Ký(dfd)ri(cd)e(dgvfgFDCd) *(,) e(ixfgh!ivHGfvED)lé(c)i(d)son.(d) (::)`;

export const CHANTS: readonly Chant[] = [
  {
    id: "kyrie-xi-vatican-1908",
    title: "Kyrie XI",
    incipit: "Kyrie eleison",
    latinText: "Kyrie eleison. Christe eleison. Kyrie eleison.",
    mode: 1,
    usage: "kyriale",
    tags: ["ordinary", "mass", "kyrie", "mode 1"],
    notation: {
      format: "gabc",
      source: KYRIE_XI_GABC,
      provenance: {
        label: "Graduale Romanum, Vatican edition",
        year: 1908,
        page: "35*",
        url: "https://gregobase.selapa.net/chant.php?id=20184",
      },
    },
    sources: [
      {
        label: "Graduale Romanum, Vatican edition",
        year: 1908,
        page: "35*",
        url: "https://gregobase.selapa.net/chant.php?id=20184",
      },
    ],
    phrases: [
      { id: "kyrie-1", latin: "Kyrie eleison" },
      { id: "christe", latin: "Christe eleison" },
      { id: "kyrie-2", latin: "Kyrie eleison" },
    ],
  },
  {
    id: "salve-regina-simplex",
    title: "Salve Regina",
    incipit: "Salve Regina",
    latinText:
      "Salve, Regina, mater misericordiae; vita, dulcedo et spes nostra, salve.",
    mode: 5,
    usage: "antiphon",
    tags: ["marian", "antiphon", "mode 5"],
    sources: [
      {
        label: "Liber Usualis",
        year: 1961,
        page: "279",
        url: "https://gregobase.selapa.net/chant.php?id=13136",
      },
    ],
    phrases: [{ id: "salve-opening", latin: "Salve Regina" }],
  },
  {
    id: "ave-maria-antiphon",
    title: "Ave Maria",
    incipit: "Ave Maria",
    latinText: "Ave Maria, gratia plena, Dominus tecum.",
    usage: "antiphon",
    tags: ["marian", "antiphon"],
    sources: [
      {
        label: "Liber Usualis",
        year: 1961,
        page: "1679",
        url: "https://gregobase.selapa.net/chant.php?id=2844",
      },
    ],
    phrases: [{ id: "ave-opening", latin: "Ave Maria, gratia plena" }],
  },
];
