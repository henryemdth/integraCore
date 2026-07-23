import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // action: {
        //   blue: "hsl(var(--action-blue))",
        // },
        success: {
          DEFAULT: "hsl(var(--success-green))",
          foreground: "hsl(0 0% 100%)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning-amber))",
          foreground: "hsl(0 0% 0%)",
        },
        error: {
          DEFAULT: "hsl(var(--error-crimson))",
          foreground: "hsl(0 0% 100%)",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          dim: "hsl(var(--surface-dim))",
          "container-low": "hsl(var(--surface-container-low))",
          container: "hsl(var(--surface-container))",
          "container-high": "hsl(var(--surface-container-high))",
          "container-highest": "hsl(var(--surface-container-highest))",
          variant: "hsl(var(--surface-variant))",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Avenir", "Helvetica", "Arial", "sans-serif"],
        data: ["var(--font-data)"],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        full: "9999px",
      },
      spacing: {
        "container-margin": "1rem",
        gutter: "0.75rem",
        "stack-sm": "0.25rem",
        "stack-md": "0.5rem",
        "stack-lg": "1rem",
        "touch-target": "2.75rem",
      },
      fontSize: {
        "headline-lg": ["1.5rem", { lineHeight: "2rem", fontWeight: "700", letterSpacing: "-0.02em" }],
        "headline-md": ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600", letterSpacing: "-0.01em" }],
        "headline-sm": ["1rem", { lineHeight: "1.5rem", fontWeight: "600" }],
        "body-lg": ["1rem", { lineHeight: "1.5rem" }],
        "body-md": ["0.875rem", { lineHeight: "1.25rem" }],
        "body-sm": ["0.75rem", { lineHeight: "1rem" }],
        "data-lg": ["1.125rem", { lineHeight: "1.5rem", fontWeight: "600" }],
        "data-md": ["0.875rem", { lineHeight: "1.25rem", fontWeight: "500" }],
        "label-caps": ["0.6875rem", { lineHeight: "1rem", fontWeight: "700", letterSpacing: "0.05em" }],
      },
      boxShadow: {
        "subtle": "0 1px 3px rgba(0,0,0,0.05)",
        "elevated": "0 4px 12px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
