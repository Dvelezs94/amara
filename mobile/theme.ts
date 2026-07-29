/**
 * Mobile visual tokens aligned with web `tailwind.config.ts` + AppShell / globals.
 * Prefer these over ad-hoc hex in StyleSheets.
 */
export const theme = {
  surface: "#F8FAFC",
  surfaceMuted: "#E8E8E8",
  pageBg: "#E4E4E7",
  white: "#FFFFFF",
  card: "#FFFFFF",

  zinc50: "#FAFAFA",
  zinc100: "#F4F4F5",
  zinc200: "#E4E4E7",
  zinc300: "#D4D4D8",
  zinc400: "#A1A1AA",
  zinc500: "#71717A",
  zinc600: "#52525B",
  zinc700: "#3F3F46",
  zinc800: "#27272A",
  zinc900: "#18181B",

  /** Brand neutrals (AMISSA manual) */
  text: "#525252",
  textStrong: "#000000",
  textMuted: "#9E9F9F",
  neutral400: "#9E9F9F",
  neutral700: "#6A6A6A",
  neutral900: "#000000",

  primary: "#02257D",
  primary50: "#E8ECF7",
  primary100: "#C5D0EB",
  primary200: "#9EB2DB",
  primary600: "#02257D",
  primary700: "#021E68",
  primary800: "#011752",

  accent: "#F14C03",
  accent50: "#FFF4ED",
  accent100: "#FFE0D0",
  accent600: "#D74403",

  supportGreen: "#6FAF6F",

  red50: "#FEF2F2",
  red600: "#DC2626",

  /** `.wo-kind-routine` / `.wo-kind-on-demand` in globals.css */
  kindRoutineBg: "#DBEAFE",
  kindRoutineFg: "#1D4ED8",
  kindRoutineBorder: "#93C5FD",
  kindOnDemandBg: "#FFEDD5",
  kindOnDemandFg: "#9A3412",
  kindOnDemandBorder: "#FDBA74",
} as const;

export type AppTheme = typeof theme;
