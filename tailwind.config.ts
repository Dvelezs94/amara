import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /** AMISSA manual: Azul #02257D */
        primary: {
          50: "#E8ECF7",
          100: "#C5D0EB",
          200: "#9EB2DB",
          300: "#6E8CC9",
          400: "#3E65B0",
          500: "#1E4A96",
          600: "#02257D",
          700: "#021E68",
          800: "#011752",
          900: "#01103D",
        },
        /** AMISSA manual: Naranja #F14C03 */
        accent: {
          50: "#FFF4ED",
          100: "#FFE0D0",
          200: "#FFC2A1",
          300: "#FF9D6A",
          400: "#FF7733",
          500: "#F14C03",
          600: "#D74403",
          700: "#B63A02",
          800: "#942F02",
          900: "#6B2200",
        },
        surface: {
          DEFAULT: "#F8FAFC",
          card: "#FFFFFF",
          muted: "#E8E8E8",
        },
        /** AMISSA manual: Gris #9E9F9F */
        neutral: {
          400: "#9E9F9F",
          700: "#6A6A6A",
          900: "#000000",
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
