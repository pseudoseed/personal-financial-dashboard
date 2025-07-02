import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
  	extend: {
  		colors: {
  			primary: {
  				'50': '#faf5ff',
  				'100': '#f3e8ff',
  				'200': '#e9d5ff',
  				'300': '#d8b4fe',
  				'400': '#c084fc',
  				'500': '#a855f7',
  				'600': '#9333ea',
  				'700': '#7e22ce',
  				'800': '#6b21a8',
  				'900': '#581c87',
  				DEFAULT: '#a855f7',
  				foreground: '#ffffff'
  			},
  			secondary: {
  				'50': '#f8fafc',
  				'100': '#f1f5f9',
  				'200': '#e2e8f0',
  				'300': '#cbd5e1',
  				'400': '#94a3b8',
  				'500': '#64748b',
  				'600': '#475569',
  				'700': '#334155',
  				'800': '#1e293b',
  				'900': '#0f172a',
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			success: {
  				'50': '#f0fdf4',
  				'100': '#dcfce7',
  				'200': '#bbf7d0',
  				'300': '#86efac',
  				'400': '#4ade80',
  				'500': '#00ff85',
  				'600': '#16a34a',
  				'700': '#15803d',
  				'800': '#166534',
  				'900': '#14532d'
  			},
  			warning: {
  				'50': '#fffbeb',
  				'100': '#fef3c7',
  				'200': '#fde68a',
  				'300': '#fcd34d',
  				'400': '#fbbf24',
  				'500': '#f59e0b',
  				'600': '#d97706',
  				'700': '#b45309',
  				'800': '#92400e',
  				'900': '#78350f'
  			},
  			error: {
  				'50': '#faf5ff',
  				'100': '#f3e8ff',
  				'200': '#e9d5ff',
  				'300': '#d8b4fe',
  				'400': '#c084fc',
  				'500': '#a855f7',
  				'600': '#9333ea',
  				'700': '#7c3aed',
  				'800': '#6b21a8',
  				'900': '#581c87'
  			},
  			surface: {
  				'0': '#ffffff',
  				'50': '#fafafa',
  				'100': '#fafafa',
  				'200': '#e5e5e5',
  				'300': '#d4d4d4',
  				'400': '#a3a3a3',
  				'500': '#737373',
  				'600': '#525252',
  				'700': '#404040',
  				'800': '#262626',
  				'900': '#171717'
  			},
  			'surface-dark': {
  				'0': '#000000',
  				'50': '#171717',
  				'100': '#262626',
  				'200': '#404040',
  				'300': '#525252',
  				'400': '#737373',
  				'500': '#a3a3a3',
  				'600': '#d4d4d4',
  				'700': '#e5e5e5',
  				'800': '#f5f5f5',
  				'900': '#fafafa'
  			},
  			border: 'hsl(var(--border))',
  			'border-dark': {
  				light: '#374151',
  				DEFAULT: '#4b5563',
  				dark: '#6b7280'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			sans: [
  				'Inter',
  				'system-ui',
  				'-apple-system',
  				'sans-serif'
  			],
  			mono: [
  				'JetBrains Mono',
  				'Monaco',
  				'Consolas',
  				'monospace'
  			]
  		},
  				fontSize: {
			// Industry standard typography scale
			xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.025em' }],      // 12px
			sm: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.025em' }],  // 14px
			base: ['1rem', { lineHeight: '1.5rem', letterSpacing: '0.025em' }],     // 16px
			lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '0.025em' }],  // 18px
			xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '0.025em' }],   // 20px
			'2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '0.025em' }],    // 24px
			'3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '0.025em' }], // 30px
			'4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '0.025em' }],  // 36px
			'5xl': ['3rem', { lineHeight: '1.2', letterSpacing: '0.025em' }],       // 48px
			'6xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '0.025em' }],    // 60px
		},
		spacing: {
			// 8px grid system
			'0.5': '0.125rem',  // 2px
			'1': '0.25rem',     // 4px
			'1.5': '0.375rem',  // 6px
			'2': '0.5rem',      // 8px
			'2.5': '0.625rem',  // 10px
			'3': '0.75rem',     // 12px
			'3.5': '0.875rem',  // 14px
			'4': '1rem',        // 16px
			'5': '1.25rem',     // 20px
			'6': '1.5rem',      // 24px
			'7': '1.75rem',     // 28px
			'8': '2rem',        // 32px
			'9': '2.25rem',     // 36px
			'10': '2.5rem',     // 40px
			'11': '2.75rem',    // 44px
			'12': '3rem',       // 48px
			'14': '3.5rem',     // 56px
			'16': '4rem',       // 64px
			'18': '4.5rem',     // 72px
			'20': '5rem',       // 80px
			'24': '6rem',       // 96px
			'28': '7rem',       // 112px
			'32': '8rem',       // 128px
			'36': '9rem',       // 144px
			'40': '10rem',      // 160px
			'44': '11rem',      // 176px
			'48': '12rem',      // 192px
			'52': '13rem',      // 208px
			'56': '14rem',      // 224px
			'60': '15rem',      // 240px
			'64': '16rem',      // 256px
			'72': '18rem',      // 288px
			'80': '20rem',      // 320px
			'96': '24rem',      // 384px
		},
		borderRadius: {
			// Industry standard border radius
			none: '0px',
			sm: '0.25rem',      // 4px
			DEFAULT: '0.375rem', // 6px
			md: '0.5rem',       // 8px
			lg: '0.75rem',      // 12px
			xl: '1rem',         // 16px
			'2xl': '1.5rem',    // 24px
			'3xl': '2rem',      // 32px
			full: '9999px',
		},
  		boxShadow: {
  			sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  			DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  			md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.05)',
  			lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  			xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  			'2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  			inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  			none: 'none'
  		},
  		animation: {
  			'fade-in': 'fadeIn 0.2s ease-out',
  			'slide-up': 'slideUp 0.2s ease-out',
  			'slide-down': 'slideDown 0.2s ease-out',
  			'scale-in': 'scaleIn 0.2s ease-out',
  			'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite'
  		},
  		keyframes: {
  			fadeIn: {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			},
  			slideUp: {
  				'0%': {
  					transform: 'translateY(10px)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateY(0)',
  					opacity: '1'
  				}
  			},
  			slideDown: {
  				'0%': {
  					transform: 'translateY(-10px)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateY(0)',
  					opacity: '1'
  				}
  			},
  			scaleIn: {
  				'0%': {
  					transform: 'scale(0.95)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'scale(1)',
  					opacity: '1'
  				}
  			}
  		},
  		backdropBlur: {
  			xs: '2px'
  		},
  		transitionProperty: {
  			height: 'height',
  			spacing: 'margin, padding'
  		}
  	}
  },
  plugins: [],
};

export default config;
