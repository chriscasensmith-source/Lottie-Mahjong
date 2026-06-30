import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // American Mahjong tile-ink colors (as printed on the NMJL card).
        tile: {
          green: "#137a4b",
          red: "#c0392b",
          blue: "#1f5fa8",
          neutral: "#2b2b2b",
        },
        felt: {
          DEFAULT: "#0f5132",
          dark: "#0a3d26",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
      },
      keyframes: {
        "pop-in": {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pop-in": "pop-in 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
