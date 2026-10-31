export const THEME_COOKIE = "theme";
export const THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "Match my device" },
] as const;
export type Theme = (typeof THEMES)[number]["id"];

/** Light unless the person picked something else in Settings. */
export function parseTheme(value: string | undefined): Theme {
  return THEMES.some((t) => t.id === value) ? (value as Theme) : "light";
}
