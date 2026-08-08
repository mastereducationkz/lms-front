import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import apiClient from '../../services/api';
import { getGroupProgramType, PROGRAM_BADGE_STYLES } from '../../lib/groupPicker';
import { platformLinksForTracks, type PlatformLink } from '../../lib/platformLinks';
import type { Group } from '../../types';

/**
 * Track-aware links to the dedicated SAT / NUET / IELTS platforms.
 *
 * Entitlement comes from the student's live group memberships. `GET /users/groups/me`
 * already filters to `is_active AND NOT is_over`, so an archived or finished group
 * never grants a tile. Track resolution reuses `getGroupProgramType`, which prefers the
 * stored `program_type` and falls back to a word-boundary name match - necessary
 * because the backfill migration never set `nuet`, so legacy NUET groups are still
 * stored as `general_english`.
 *
 * Renders nothing at all (no heading, no empty state) when the student has no
 * applicable track, so General-English-only and trial students see an unchanged
 * dashboard rather than an empty section.
 */
export function TrackPlatformLinks() {
  const [links, setLinks] = useState<PlatformLink[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const groups: Group[] = await apiClient.getMyGroups();
        // Special-group-only students are internal cohorts, not track students.
        const eligible = groups.filter((g) => !g.is_special);
        const resolved = platformLinksForTracks(eligible.map(getGroupProgramType));
        if (!cancelled) setLinks(resolved);
      } catch {
        // A failed lookup must not render links the student may not be entitled to.
        // Fail closed and stay silent rather than guessing.
        if (!cancelled) setLinks([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // null = still loading. Render nothing rather than a skeleton that would flash
  // for the majority of students who have no tiles at all.
  if (links === null || links.length === 0) return null;

  return (
    <section aria-labelledby="track-platforms-heading" className="mt-2">
      <h2
        id="track-platforms-heading"
        className="text-sm font-medium text-muted-foreground mb-3"
      >
        Your programs
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {links.map((link) => (
          <Card key={link.track} className="h-fit">
            <CardContent className="p-5 flex items-center gap-4">
              <div
                className={`rounded-md p-3 text-sm font-semibold ${PROGRAM_BADGE_STYLES[link.track]}`}
                aria-hidden="true"
              >
                {link.label}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{link.label} platform</p>
                <p className="text-xs text-muted-foreground">{link.description}</p>
              </div>
              <Button asChild size="sm" variant="secondary">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open the ${link.label} platform in a new tab`}
                >
                  Open
                  <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default TrackPlatformLinks;
