import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  to?: string;
  label: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  /** Accessible name of the trail (localised by the caller). */
  label?: string;
}

/** A crumb trail that wraps on phones: each separator stays with the crumb after it, spaced from both sides. */
export default function Breadcrumbs({ items = [], label }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;
  return (
    <nav aria-label={label} className="mb-4 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((it, idx) => (
          <li key={idx} className="flex min-w-0 items-center gap-2">
            {idx > 0 && <span aria-hidden="true" className="opacity-50">/</span>}
            {it.to ? (
              <Link to={it.to} className="min-w-0 break-words hover:text-foreground">{it.label}</Link>
            ) : (
              <span aria-current="page" className="min-w-0 break-words text-foreground">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
