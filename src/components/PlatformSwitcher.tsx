import { ExternalLink } from 'lucide-react';
import { PLATFORM_URLS } from '../lib/platformLinks';

/**
 * Links to the sibling Master Education platforms.
 *
 * Used pre-authentication (the sign-in page), where we cannot know the visitor's
 * track, so all three are shown. Deliberately understated: it must help someone who
 * landed on the wrong property without competing with the primary sign-in action.
 *
 * These are plain external links. The LMS is an OIDC relying party only - there is no
 * token-handoff helper - but all three platforms share the same Zitadel session, so a
 * signed-in user lands already authenticated.
 */

const PLATFORMS: { key: keyof typeof PLATFORM_URLS; label: string }[] = [
  { key: 'sat', label: 'SAT' },
  { key: 'nuet', label: 'NUET' },
  { key: 'ielts', label: 'IELTS' },
];

export function PlatformSwitcher({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="Other Master Education platforms" className={className}>
      <p className="text-xs text-muted-foreground mb-2">Other Master Education platforms</p>
      <ul className="flex flex-wrap items-center gap-2">
        {PLATFORMS.map((p) => (
          <li key={p.key}>
            <a
              href={PLATFORM_URLS[p.key]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {p.label}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default PlatformSwitcher;
