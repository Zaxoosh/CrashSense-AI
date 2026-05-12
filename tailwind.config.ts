import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1020",
        panel: "#12182b",
        line: "#28324a",
        accent: "#47d6a7",
        warn: "#f6c177",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(71, 214, 167, 0.22), 0 20px 80px rgba(0, 0, 0, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
