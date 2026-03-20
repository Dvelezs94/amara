import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#EEF2FB",
          100: "#DDE5F7",
          200: "#BBCBF0",
          300: "#99B1E8",
          400: "#7797E1",
          500: "#557DDA",
          600: "#1F3C88",
          700: "#1A3272",
          800: "#14285B",
          900: "#0F1E45",
        },
        accent: {
          50: "#FEF1E9",
          100: "#FDE2D3",
          200: "#FBC5A8",
          300: "#F9A87C",
          400: "#F78B51",
          500: "#F36C21",
          600: "#D95A16",
          700: "#B84A0F",
          800: "#973C0B",
          900: "#762E08",
        },
        surface: {
          DEFAULT: "#F5F5F5",
          card: "#FFFFFF",
          muted: "#E6E6E6",
        },
        neutral: {
          700: "#4A4A4A",
          900: "#222222",
        },
        support: {
          green: "#6FAF6F",
        },
      },
      fontFamily: {
        sans: ["var(--font-roboto)", "system-ui", "sans-serif"],
      },
      maxWidth: {
        app: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
