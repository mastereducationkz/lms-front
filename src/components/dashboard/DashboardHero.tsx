import { useState, type CSSProperties } from "react";
import { Check } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import ExamCountdown from "../ExamCountdown";

// Dashboard hero background presets (all dark so white text + the flip board stay legible).
// `tile` is an opaque, banner-tinted color for the flip-clock digits (must be
// opaque so the folding flap hides the digit behind it without ghosting).
// `hue`/`sat` drive the dark-mode banner: never a bright block on a dark page, but a dark
// surface tinted with the preset's hue, a soft glow of it in the corner and a tinted edge.
const HERO_THEMES: { key: string; label: string; css: string; tile: string; hue: number; sat: number }[] = [
  { key: "blue", label: "Blue", css: "linear-gradient(to right, #3b6ff0, #6366f1)", tile: "#2c3488", hue: 221, sat: 36 },
  { key: "teal", label: "Teal", css: "linear-gradient(to bottom, #0d9488, #0f766e)", tile: "#0a4a44", hue: 175, sat: 36 },
  { key: "emerald", label: "Emerald", css: "linear-gradient(to bottom, #059669, #047857)", tile: "#0a4733", hue: 160, sat: 36 },
  { key: "violet", label: "Violet", css: "linear-gradient(to bottom, #7c3aed, #6d28d9)", tile: "#3f2280", hue: 263, sat: 36 },
  { key: "slate", label: "Slate", css: "linear-gradient(to bottom, #334155, #0f172a)", tile: "#111a2b", hue: 215, sat: 16 },
  { key: "midnight", label: "Midnight", css: "linear-gradient(to bottom, #1e3a8a, #0f1a3f)", tile: "#152a60", hue: 224, sat: 40 },
  { key: "indigo", label: "Indigo", css: "linear-gradient(to bottom, #312e81, #1e1b4b)", tile: "#221f56", hue: 244, sat: 36 },
  { key: "plum", label: "Plum", css: "linear-gradient(to bottom, #9f1239, #4c0519)", tile: "#4a0f26", hue: 343, sat: 36 },
  { key: "graphite", label: "Graphite", css: "linear-gradient(to bottom, #1f2937, #030712)", tile: "#141a24", hue: 220, sat: 10 },
];

/** The dark-mode look of a hero preset; the default blue reads the brand tokens. */
function heroDark({ key, hue, sat }: { key: string; hue: number; sat: number }) {
  const brand = key === "blue";
  return {
    glow: `radial-gradient(80% 140% at 100% 0%, ${brand ? "hsl(var(--brand) / 0.18)" : `hsl(${hue} 85% 62% / 0.16)`}, transparent 60%)`,
    surface: brand ? "hsl(var(--brand-surface))" : `hsl(${hue} ${sat}% 16%)`,
    edge: brand ? "hsl(var(--brand-border))" : `hsl(${hue} ${Math.max(sat, 12)}% 28%)`,
    tile: `hsl(${hue} ${Math.min(sat, 32)}% 23%)`,
  };
}

interface DashboardHeroProps {
  userId?: string | number;
  firstName: string;
  dailyQuestionsCompleted: boolean;
  dailyQuestionsScore: { score: number; total: number } | null;
  onGoToAllCourses: () => void;
  onOpenDailyQuestions: () => void;
}

/** The student dashboard banner: greeting, the two main actions and the exam countdown. */
export default function DashboardHero({
  userId,
  firstName,
  dailyQuestionsCompleted,
  dailyQuestionsScore,
  onGoToAllCourses,
  onOpenDailyQuestions,
}: DashboardHeroProps) {
  // Student-chosen hero banner color (persisted per user in localStorage).
  const heroThemeKey = `dashboard_hero_theme_${userId ?? "me"}`;
  const [heroTheme, setHeroTheme] = useState<string>(() => {
    try {
      return localStorage.getItem(heroThemeKey) || "blue";
    } catch {
      return "blue";
    }
  });
  const activeHeroTheme = HERO_THEMES.find((t) => t.key === heroTheme) ?? HERO_THEMES[0];
  const heroThemeCss = activeHeroTheme.css;
  const activeHeroDark = heroDark(activeHeroTheme);
  const applyHeroTheme = (key: string) => {
    setHeroTheme(key);
    try {
      localStorage.setItem(heroThemeKey, key);
    } catch {
      /* ignore storage errors */
    }
  };
  const bannerColorPicker = (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Change banner color"
          title="Banner color"
          className="h-5 w-5 rounded-full ring-2 ring-white/60 transition hover:ring-white"
          style={{ background: heroThemeCss }}
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Banner color</p>
        <div className="grid grid-cols-4 gap-2">
          {HERO_THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => applyHeroTheme(t.key)}
              title={t.label}
              aria-label={t.label}
              className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition ${
                heroTheme === t.key ? "ring-foreground" : "ring-transparent hover:ring-border"
              }`}
              style={{ background: t.css }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    // A container: greeting and countdown sit side by side only once the banner itself is
    // wide enough (@4xl), whatever the viewport - at 1100px the sidebar leaves ~780px.
    <Card
      className="@container relative overflow-hidden border-0 text-white bg-[image:var(--hero-bg)] dark:border dark:border-[color:var(--hero-edge)] dark:text-brand-surface-foreground dark:bg-[color:var(--hero-surface)] dark:bg-[image:var(--hero-glow)]"
      style={{
        "--hero-bg": heroThemeCss,
        "--hero-glow": activeHeroDark.glow,
        "--hero-surface": activeHeroDark.surface,
        "--hero-edge": activeHeroDark.edge,
      } as CSSProperties}
      data-tour="dashboard-overview"
    >
      <div className="absolute right-4 top-4 z-10">{bannerColorPicker}</div>
      <div className="flex flex-col gap-3 @4xl:flex-row @4xl:items-center @4xl:justify-between">
        {/* basis + min-width keep the greeting readable: with flex-1 alone a wide
            countdown starved this column and wrapped the heading one word per line. */}
        <div className="min-w-0 flex-1 @4xl:basis-[22rem] @4xl:min-w-[18rem]">
          {/* pr-12 keeps the greeting clear of the banner-colour dot in the top-right corner */}
          <CardHeader className="p-5 pr-12 sm:p-6 sm:pr-14">
            <CardTitle className="text-2xl sm:text-3xl">Welcome back, {firstName}!</CardTitle>
            <CardDescription className="text-white/80 text-sm sm:text-base">
              Continue your learning journey with Master Education
            </CardDescription>
          </CardHeader>
          <CardFooter className="p-5 sm:p-6 pt-0">
            <div className="flex flex-wrap gap-3">
              {/* Dark: the one blue accent on the banner is its main action. */}
              <Button
                onClick={onGoToAllCourses}
                variant="secondary"
                className="dark:bg-brand-solid dark:text-brand-solid-foreground dark:hover:bg-brand-solid-hover"
              >
                Go to courses
              </Button>
              <Button
                onClick={onOpenDailyQuestions}
                variant="outline"
                className="flex items-center gap-2 text-black dark:border-brand-border dark:bg-transparent dark:text-brand-surface-foreground dark:hover:bg-brand-subtle dark:hover:text-brand-surface-foreground"
              >
                {dailyQuestionsCompleted
                  ? dailyQuestionsScore
                    ? `Result: ${dailyQuestionsScore.score}/${dailyQuestionsScore.total}`
                    : 'Tasks completed'
                  : 'Daily questions'}
                {dailyQuestionsCompleted && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="done" />}
              </Button>
            </div>
          </CardFooter>
        </div>
        <div className="px-5 pb-5 @4xl:py-4 @4xl:pr-14 @4xl:pl-0 flex justify-center @4xl:justify-end shrink-0">
          <ExamCountdown tileColor={activeHeroTheme.tile} tileColorDark={activeHeroDark.tile} />
        </div>
      </div>
    </Card>
  );
}
