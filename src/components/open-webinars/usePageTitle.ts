import { useEffect } from 'react';

const SITE = 'Master Education';

/**
 * The browser tab's title for a public page: «<what the page is> · Master Education», in the language the visitor chose.
 * Every public page used to leave the app's «Master LMS», so a shared webinar link, a bookmark and the tab bar all said
 * nothing about the webinar. The previous title comes back when the page goes away.
 */
export function usePageTitle(title: string | null | undefined): void {
  useEffect(() => {
    const text = (title ?? '').trim();
    if (!text) return undefined;
    const previous = document.title;
    document.title = `${text} · ${SITE}`;
    return () => { document.title = previous; };
  }, [title]);
}
