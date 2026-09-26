import type { Config } from "tailwindcss";

// Same five core colours as branding/theme/areta-theme.json (the Power BI
// report theme) — one palette, both front ends. If this ever needs to
// change, change it there too, don't let the two drift apart.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        // "Fit" is the desktop dashboard layout: the grid fills exactly
        // one screen, like the reference board, with no page scroll.
        // It needs height as well as width, so a wide but short window
        // (a laptop with the browser toolbar open) falls back to the
        // scrolling layout rather than squashing every chart.
        fit: { raw: "(min-width: 1280px) and (min-height: 820px)" },
      },
      colors: {
        "deep-terrain": "#003744",
        "mountain-teal": "#1F7486",
        "summit-gold": "#D0AA62",
        "rock-slate": "#4A5B63",
        "alpine-stone": "#E8E1D6",
        // Canvas background for the dark theme — a much darker version
        // of deep-terrain (same hue, lower lightness), not a separate
        // colour family. Chart cards sit on this at deep-terrain itself,
        // so the two need to read as "darker shade of the same teal"
        // sitting behind "the teal", not two unrelated darks.
        abyss: "#00141A",
        charcoal: "#0F1A1E",
        slate: "#2F3A40",
        stone: "#5B6A72",
        mist: "#8D9AA1",
        cloud: "#F7F6F3",
        success: "#2E7D32",
        warning: "#F9A825",
        error: "#D32F2F",
        info: "#0288D1",
        highlight: "#8E2AAA",
      },
      fontFamily: {
        sans: ["Montserrat", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "topo-dark": "url('/images/topo-pattern-dark.webp')",
        "topo-light": "url('/images/topo-pattern-light.webp')",
      },
    },
  },
  plugins: [],
};

export default config;