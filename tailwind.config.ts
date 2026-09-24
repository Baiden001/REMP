import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0b2219",
        ink: "#11251d",
        blue: "#1f5a44",
        blueSoft: "#f2fbf7",
        paper: "#ffffff",
        page: "#f6f9f8",
        line: "#eaefec",
        muted: "#718096",
        green: "#15946b",
        orange: "#c8752b",
        gold: "#e7a33b",
        brandGold: "#b08d57",
      },
      borderRadius: {
        remp: "14px",
      },
      boxShadow: {
        remp: "0 8px 24px rgba(21,46,36,.055)",
      },
    },
  },
  plugins: [],
};

export default config;
