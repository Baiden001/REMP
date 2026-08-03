import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: "#061e3a",
        ink: "#10233e",
        blue: "#2775e6",
        blueSoft: "#edf4ff",
        paper: "#ffffff",
        page: "#f5f7fa",
        line: "#e7ebf1",
        muted: "#718096",
        green: "#15946b",
        orange: "#c8752b",
        gold: "#e7a33b",
      },
      borderRadius: {
        remp: "14px",
      },
      boxShadow: {
        remp: "0 8px 24px rgba(19,42,77,.055)",
      },
    },
  },
  plugins: [],
};

export default config;
