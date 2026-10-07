import { Mail, Phone, MapPin } from "lucide-react";
import LogoIcon from '../../assets/masteredlogo-ico.ico';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/publicPages';

export function Footer() {
  const t = useT();
  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={LogoIcon} alt="Master Education" className="h-10 w-10 text-primary" />
              <span className="text-lg font-bold">Master Education</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t('publicPages.landing.footer.tagline')}
            </p>
            <div className="text-sm text-muted-foreground">mastereducation.kz</div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">{t('publicPages.landing.footer.support')}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">{t('publicPages.landing.footer.docs')}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{t('publicPages.landing.footer.guides')}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{t('publicPages.landing.footer.faq')}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{t('publicPages.landing.footer.techSupport')}</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">{t('publicPages.landing.footer.contacts')}</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Mail className="h-4 w-4" /><span>info@mastereducation.kz</span></div>
              <div className="flex items-center gap-2"><Phone className="h-4 w-4" /><span>+7 (777) 123-45-67</span></div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span>{t('publicPages.landing.footer.city')}</span></div>
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 text-center text-sm text-muted-foreground">
          <p>{t('publicPages.landing.footer.rights')}</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;


