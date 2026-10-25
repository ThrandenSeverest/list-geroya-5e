/** Select home art for all app shells, including mobile, Android and Windows. */
export function selectHomeHeroArt(siteTheme: "classic" | "parchment", activePreset: string): string {
  // The two original artworks are deliberately preserved.
  if (!activePreset) return siteTheme === "classic" ? "home/hero-night.webp" : "home/hero-day.webp";
  return "home/hero-universal.png";
}
