/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        trail: {
          50: "#ECFDF6",
          100: "#D0F7E7",
          200: "#A3EFD0",
          300: "#6BE0B4",
          400: "#34C994",
          500: "#12B886",
          600: "#0E9A70",
          700: "#0C7A5A",
          800: "#0B6048",
          900: "#0A4C3A",
        },
        ember: {
          100: "#FDE9C2",
          300: "#F9BE4E",
          400: "#F5A623",
          600: "#B86E08",
        },
        slate: {
          50: "#F6F8FA",
          100: "#EDF1F5",
          200: "#DCE3EB",
          300: "#B9C4D0",
          400: "#8695A8",
          500: "#5D6B80",
          600: "#45516A",
          700: "#323C4E",
          800: "#1F2836",
          900: "#141B26",
          950: "#0C111A",
        },
        success: "#12B886",
        warning: "#F97316",
        danger: "#EF4444",
        info: "#3B82F6",
        q: {
          logic: "#3B82F6",
          scenario: "#8B5CF6",
          project: "#12B886",
          code: "#F5A623",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
      },
    },
  },
  plugins: [],
};
