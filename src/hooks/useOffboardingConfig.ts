import { useEffect, useState } from 'react';
import { getOffboardingConfig, type OffboardingConfig } from '../services/api/offboarding';

const OFFBOARDING_ROLES: ReadonlySet<string> = new Set(['admin', 'head_teacher', 'head_curator']);

/**
 * The offboarding switch (SPEC §7) for the signed-in role. Every Offboard button, nav entry and
 * page waits on it and shows nothing until it says enabled. The request cache shares one fetch
 * between the sidebar and the page; other roles never ask.
 */
export function useOffboardingConfig(role: string | null | undefined): OffboardingConfig | null {
  const [config, setConfig] = useState<OffboardingConfig | null>(null);
  const eligible = !!role && OFFBOARDING_ROLES.has(role);

  useEffect(() => {
    if (!eligible) {
      setConfig(null);
      return;
    }
    let live = true;
    getOffboardingConfig().then((c) => {
      if (live) setConfig(c);
    });
    return () => {
      live = false;
    };
  }, [eligible]);

  return eligible ? config : null;
}
