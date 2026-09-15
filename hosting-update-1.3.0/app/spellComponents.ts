import type { CatalogSpell } from "./catalog";
import { spellComponentsById } from "./spellComponents.generated";

export function spellComponentLabel(spell: Pick<CatalogSpell, "id"> & Partial<Pick<CatalogSpell, "components" | "description">>) {
  const data = spellComponentsById[spell.id as keyof typeof spellComponentsById];
  if (data) return data.components.map(component => component === "M" && data.materialSpecial ? "М*" : component === "V" ? "В" : component === "S" ? "С" : "М").join("/") || "—";
  if (!spell.components) return "—";
  const materialSpecial = /стоимост|\d+\s*(?:зм|см|мм|пм)|расход/i.test(`${spell.components} ${spell.description || ""}`);
  return [
    /(?:^|[,\s])В(?:[,\s]|$)/.test(spell.components) ? "В" : "",
    /(?:^|[,\s])С(?:[,\s]|$)/.test(spell.components) ? "С" : "",
    /(?:^|[,\s])М(?:[,\s(]|$)/.test(spell.components) ? `М${materialSpecial ? "*" : ""}` : "",
  ].filter(Boolean).join("/") || "—";
}
