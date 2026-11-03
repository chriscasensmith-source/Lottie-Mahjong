import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // App palette: cream backgrounds, maroon accents.
        cream: {
          50: "#FFFCF6",
          100: "#FAF4E7",
          200: "#F3EAD6",
          300: "#E7D9BA",
          400: "#D5C094",
          500: "#B9A06D",
        },
        maroon: {
          50: "#FBF0F2",
          100: "#F4DCE0",
          200: "#E7B3BC",
          300: "#CF7D8C",
          400: "#AC3E55",
          500: "#8C2136",
          600: "#741629",
          700: "#5E1020",
          800: "#4A0C19",
          900: "#340811",
        },
        // Game-outcome status colors (always paired with an icon + label).
        outcome: {
          win: "#3F7D4E",
          "win-soft": "#E3EFE2",
          "win-ink": "#2C5E38",
          loss: "#6B6E80",
          "loss-soft": "#E8E7EE",
          "loss-ink": "#45485A",
          wall: "#B7811F",
          "wall-soft": "#F7EBCB",
          "wall-ink": "#7A5410",
        },
        // American Mahjong tile-ink colors (as printed on the NMJL card).
        tile: {
          green: "#137a4b",
          red: "#c0392b",
          blue: "#1f5fa8",
          neutral: "#2b2b2b",
        },
      },
      fontFamily: {
        display: ["ui-serif", "Georgia", "Cambria", "Times New Roman", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
