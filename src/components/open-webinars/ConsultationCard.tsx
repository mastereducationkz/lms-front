import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import ContactForm from './ContactForm';
import { requestConsultation } from '../../services/api/publicWebinars';
import type { Locale } from '../../lib/i18n/locale';
import type { TFunction } from '../../lib/i18n/translate';
import '@/lib/i18n/catalogs/openWebinars';

interface Props {
  t: TFunction;
  locale: Locale;
  webinarSlug: string;
  consent: { text_ru: string; text_en: string; policy_ready: boolean };
}

/** «Leave your number for a free consultation»: the one lead capture for people who never register. */
export default function ConsultationCard({ t, locale, webinarSlug, consent }: Props) {
  const [done, setDone] = useState(false);
  if (!consent.policy_ready) return null;               // no collecting numbers without a published policy
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="ow-card-title">
      <h2 id="ow-card-title" className="text-base font-semibold text-foreground">{t('openWebinars.card.title')}</h2>
      {done ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-foreground"><CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden />{t('openWebinars.card.thanks')}</p>
      ) : (
        <>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">{t('openWebinars.card.text')}</p>
          <ContactForm
            t={t}
            withEmail={false}
            consentText={locale === 'ru' ? consent.text_ru : consent.text_en}
            submitLabel={t('openWebinars.card.submit')}
            onSubmit={async (body) => { await requestConsultation(webinarSlug, body); setDone(true); }}
          />
        </>
      )}
    </section>
  );
}
