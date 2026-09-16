import type { Config } from "tailwindcss";

// Same five core colours as branding/theme/areta-theme.json (the Power BI
// report theme) — one palette, both front ends. If this ever needs to
// change, change it there too, don't let the two drift apart.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "deep-terrain": "#003744",
        "mountain-teal": "#1F7486",
        "summit-gold": "#D0AA62",
        "rock-slate": "#4A5B63",
        "alpine-stone": "#E8E1D6",
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