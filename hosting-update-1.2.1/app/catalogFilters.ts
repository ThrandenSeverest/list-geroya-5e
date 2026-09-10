import type { CatalogOption } from "./catalog";

const sourceCode = /\b(PHB|DMG|SCAG|VGM|XGE|MTF|GGR|ERLW|TCE|VRGR|WBW|MPMM|SCC|MOT|SDQ|BMT|FTD|EGW|AI|SAS|PAM|IDROTF|AAG|OGA|BPGG|GGTR|BGDIA|GOS|TOA)\b/g;

export function sourceTokens(source: string) {
  const codes = source.toUpperCase().match(sourceCode);
  return codes?.length ? [...new Set(codes.map(code => code === "IDROTF" ? "IDRotF" : code))] : [source.trim()];
}

export function catalogSources(options: Pick<CatalogOption, "source">[]) {
  return [...new Set(options.flatMap(option => sourceTokens(option.source)))].sort((a, b) => {
    if (a === "PHB") return -1;
    if (b === "PHB") return 1;
    return a.localeCompare(b, "ru");
  });
}

export function matchesSources(source: string, selected: string[]) {
  return sourceTokens(source).some(book => selected.includes(book));
}
