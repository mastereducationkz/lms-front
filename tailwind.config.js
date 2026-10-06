
export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./meet-addon.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'Inter',
  				'ui-sans-serif',
  				'system-ui',
  				'sans-serif'
  			]
  		},
  		colors: {
  			// Semantic brand blue (values + roles: the token table in src/index.css).
  			brand: {
  				DEFAULT: 'hsl(var(--brand) / <alpha-value>)',
  				solid: 'hsl(var(--brand-solid) / <alpha-value>)',
  				'solid-hover': 'hsl(var(--brand-solid-hover) / <alpha-value>)',
  				'solid-foreground': 'hsl(var(--brand-solid-foreground) / <alpha-value>)',
  				surface: 'hsl(var(--brand-surface) / <alpha-value>)',
  				'surface-foreground': 'hsl(var(--brand-surface-foreground) / <alpha-value>)',
  				subtle: 'hsl(var(--brand-subtle) / <alpha-value>)',
  				'subtle-foreground': 'hsl(var(--brand-subtle-foreground) / <alpha-value>)',
  				border: 'hsl(var(--brand-border) / <alpha-value>)'
  			},
  			background: 'hsl(var(--background) / <alpha-value>)',
  			foreground: 'hsl(var(--foreground) / <alpha-value>)',
  			card: {
  				DEFAULT: 'hsl(var(--card) / <alpha-value>)',
  				foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
  				foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
  				foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
  				foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
  				foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
  				foreground: 'hsl(var(--accent-foreground) / <alpha-value>)'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
  				foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
  			},
  			border: 'hsl(var(--border) / <alpha-value>)',
  			input: 'hsl(var(--input) / <alpha-value>)',
  			ring: 'hsl(var(--ring) / <alpha-value>)',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		// Theme-aware: light values are Tailwind's own, dark ones are deeper (src/index.css).
  		boxShadow: {
  			sm: 'var(--shadow-sm)',
  			DEFAULT: 'var(--shadow)',
  			md: 'var(--shadow-md)',
  			lg: 'var(--shadow-lg)',
  			xl: 'var(--shadow-xl)',
  			'2xl': 'var(--shadow-2xl)',
  			card: 'var(--shadow-card)'
  		},
  		// text-primary reads as brand blue in dark mode; bg-primary stays the button fill.
  		textColor: {
  			primary: {
  				DEFAULT: 'hsl(var(--primary-text) / <alpha-value>)'
  			}
  		},
  		borderRadius: {
  			xl: '16px',
  			'2xl': '20px',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			// A progress bar whose percent is not known yet: a segment sweeping across.
  			'recording-indeterminate': {
  				'0%': {
  					transform: 'translateX(-100%)'
  				},
  				'100%': {
  					transform: 'translateX(300%)'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'recording-indeterminate': 'recording-indeterminate 1.6s ease-in-out infinite'
  		}
  	}
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    // @container / @lg: etc. - layouts follow the width they are given, not the viewport
    require("@tailwindcss/container-queries"),
  ],
} 