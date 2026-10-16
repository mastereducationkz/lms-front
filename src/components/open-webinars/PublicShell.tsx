import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import logoIco from '../../assets/masteredlogo-ico.ico';
import { cn } from '../../lib/utils';
import type { Locale } from '../../lib/i18n/locale';
import type { TFunction } from '../../lib/i18n/translate';
import '@/lib/i18n/catalogs/openWebinars';

interface Props {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: TFunction;
  children: ReactNode;
  /** The privacy page itself needs no link to itself. */
  hidePrivacyLink?: boolean;
}

const LANGUAGES: Locale[] = ['ru', 'en'];

/** The frame of every page a visitor opens without signing in: brand, language, privacy policy. */
export default function PublicShell({ locale, setLocale, t, children, hidePrivacyLink }: Props) {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src={logoIco} alt="" className="h-7 w-7 rounded" />
            <span className="text-sm font-semibold text-foreground">{t('openWebinars.brand')}</span>
          </div>
          <div role="group" aria-label={t('openWebinars.langSwitch')} className="inline-flex rounded-lg border border-border bg-card p-0.5 text-xs">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLocale(lang)}
                aria-pressed={locale === lang}
                className={cn('rounded-md px-2.5 py-1 font-medium transition', locale === lang ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                {t(lang === 'ru' ? 'openWebinars.lang.ru' : 'openWebinars.lang.en')}
              </button>
            ))}
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{t('openWebinars.footer.copyright')}</span>
          {!hidePrivacyLink && (
            <Link to="/privacy" className="underline-offset-4 hover:underline">{t('openWebinars.footer.privacy')}</Link>
          )}
        </footer>
      </div>
    </div>
  );
}
