/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#05060d",
          frame: "#0a0d1c",
        },
        ink: {
          DEFAULT: "#dce1f0",
          dim: "#7a8299",
        },
        accent: {
          DEFAULT: "#e8b86d",
          dim: "#6a5329",
        },
        rule: "#1e2238",
        danger: "#e08585",
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', "ui-serif", "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
