import type { CSSProperties } from 'react';

// Recharts takes plain strings for stroke/fill/style, so these point at the CSS variables
// from src/index.css and switch with the theme on their own.
export const chartColors = {
  grid: 'hsl(var(--border))',
  tick: 'hsl(var(--muted-foreground))',
  brand: 'hsl(var(--brand))',
  surface: 'hsl(var(--card))',
  cursor: 'hsl(var(--muted) / 0.6)',
};

export const chartTick = (fontSize = 12) => ({ fontSize, fill: chartColors.tick });

export const chartTooltipStyle: CSSProperties = {
  backgroundColor: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 12,
  boxShadow: 'var(--shadow-md)',
};
