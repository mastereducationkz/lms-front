import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  title: string;
  icon: LucideIcon;
}

/**
 * The section index beside the Settings column, once the page is wide enough (@4xl of the app's
 * content container). Marks the section being read; a click scrolls to it.
 */
export default function SettingsNav({ items, label }: { items: NavItem[]; label: string }) {
  const [active, setActive] = useState(items[0]?.id ?? '');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label={label} className="hidden @4xl:block">
      <ul className="sticky top-24 space-y-0.5">
        {items.map(({ id, title, icon: Icon }) => {
          const current = id === active;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={current ? 'true' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setActive(id);
                  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`flex min-h-9 items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  current ? 'bg-brand-surface font-medium text-brand-subtle-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 flex-none" aria-hidden />
                <span className="min-w-0">{title}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
