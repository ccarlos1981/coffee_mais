/**
 * Theme tokens for High Contrast and premium visual accessibility
 * on the Coffee Mais Metas Promotor screen.
 */
export const metasPromotorTheme = {
  // Brand & Accent Colors
  gold: {
    primary: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-500 dark:bg-amber-400",
    border: "border-amber-500 dark:border-amber-400",
    hover: "hover:bg-amber-600 dark:hover:bg-amber-500",
    glow: "focus:ring-2 focus:ring-amber-500/50 dark:focus:ring-amber-400/50 focus:border-amber-500 dark:focus:border-amber-400"
  },

  // Base background tokens
  background: {
    main: "bg-neutral-50 dark:bg-neutral-950",
    card: "bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800",
    header: "bg-neutral-100 dark:bg-neutral-950/60 border-b border-neutral-200 dark:border-neutral-800",
    past: "bg-neutral-100/70 dark:bg-neutral-950/40 text-neutral-700 dark:text-neutral-400",
    future: "bg-amber-50/50 dark:bg-amber-950/10 text-neutral-900 dark:text-neutral-200"
  },

  // Text colors with WCAG AA compliance (Contrast >= 4.5:1)
  text: {
    // Primary: main headings and titles
    primary: "text-neutral-900 dark:text-neutral-100 font-extrabold",
    // Secondary: labels, metadata, captions
    secondary: "text-neutral-700 dark:text-neutral-300 font-bold",
    // Muted: placeholder, disabled, secondary detail
    muted: "text-neutral-500 dark:text-neutral-450 font-medium",
    // High contrast for badges/status
    light: "text-white",
    dark: "text-neutral-950"
  },

  // Target input fields styling
  input: {
    base: "bg-white dark:bg-neutral-950 border-1.5 border-amber-500/80 dark:border-amber-400/80 text-neutral-950 dark:text-neutral-50 font-bold focus:outline-none transition-all duration-200 shadow-sm",
    glow: "focus:ring-4 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 focus:border-amber-500 dark:focus:border-amber-400"
  },

  // State Badges
  status: {
    no_target: "bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700",
    draft: "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-900/50",
    submitted: "bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-900/50",
    approved: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-900/50",
    locked: "bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-900/50"
  },

  // Indicators
  danger: "text-red-650 dark:text-red-400 font-black",
  success: "text-emerald-600 dark:text-emerald-400 font-black"
};
