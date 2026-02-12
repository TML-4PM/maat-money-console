/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        maat: { bg: "#080e1a", card: "#0f172a", border: "#1e293b", accent: "#3b82f6", green: "#22c55e", amber: "#f59e0b", red: "#ef4444" }
      },
      fontFamily: { mono: ["JetBrains Mono", "monospace"], sans: ["Inter", "system-ui", "sans-serif"] }
    }
  },
  plugins: []
}
