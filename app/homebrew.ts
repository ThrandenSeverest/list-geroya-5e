export type HomebrewType = "ability" | "item" | "spell" | "proficiency" | "note";

export type HomebrewElement = {
  id: string;
  type: HomebrewType;
  name: string;
  description: string;
  characterId?: string;
  level?: number;
  school?: string;
  castingTime?: string;
  concentration?: boolean;
  ritual?: boolean;
  updatedAt: string;
};

export type HomebrewLibrary = { version: 1; elements: HomebrewElement[] };

export const emptyHomebrewLibrary: HomebrewLibrary = { version: 1, elements: [] };

export const homebrewTypeLabels: Record<HomebrewType, string> = {
  ability: "Способность",
  item: "Предмет",
  spell: "Заклинание",
  proficiency: "Владение",
  note: "Заметка",
};

export function normalizeHomebrewLibrary(value: Partial<HomebrewLibrary> | null | undefined): HomebrewLibrary {
  const types = new Set(Object.keys(homebrewTypeLabels));
  const elements = Array.isArray(value?.elements) ? value.elements.filter((element): element is HomebrewElement =>
    !!element && typeof element.id === "string" && types.has(element.type) && typeof element.name === "string" && typeof element.description === "string" && typeof element.updatedAt === "string"
  ) : [];
  return { version: 1, elements };
}
