import { ThinkingOrb, type OrbState, type OrbTheme } from 'thinking-orbs';

interface ThinkingLoaderProps {
  /** Animated state; pick the verb matching what the app is doing */
  state?: OrbState;
  /** 20 = inline-text scale, 64 = panel/avatar scale */
  size?: 20 | 64;
  /** auto follows the project's light/dark mode; pin "dark" for light dots on colored backgrounds */
  theme?: OrbTheme;
  /** Accessibility label; falls back to the orb's per-state default */
  label?: string;
  /** Extra classes on the canvas */
  className?: string;
}

/**
 * Project wrapper around thinking-orbs: pins the two supported sizes and the
 * auto theme (follows the `.dark` class from shadcn/Tailwind convention).
 * Use for AI/agent waits; keep branded `Loader` for brand moments and
 * Skeleton for content placeholders.
 */
export default function ThinkingLoader({
  state = 'working',
  size = 20,
  theme = 'auto',
  label,
  className = '',
}: ThinkingLoaderProps) {
  return (
    <ThinkingOrb
      state={state}
      size={size}
      theme={theme}
      aria-label={label}
      className={`shrink-0 ${className}`}
    />
  );
}
