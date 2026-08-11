import type { CatalogSpell } from "./catalog";

export const additionalSpellSources = new Set(["FTD", "EGW", "AI", "SAS", "PAM", "BMT"]);

export function isAdditionalSpell(spell: Pick<CatalogSpell, "id" | "source">) {
  return additionalSpellSources.has(spell.source) || spell.id === "spell-doc-create_magen";
}

export function sourceAvailableSpellCatalog(catalog: CatalogSpell[], additionalUnlocked: boolean) {
  return catalog.filter(spell => additionalUnlocked || !isAdditionalSpell(spell));
}

