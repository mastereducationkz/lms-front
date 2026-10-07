import { Card, CardContent } from "../ui/card";
import { BookOpen, Users, BarChart3, Shield } from "lucide-react";
import { useT } from "../../lib/i18n/react";
import '@/lib/i18n/catalogs/publicPages';

export function AboutSection() {
  const t = useT();
  return (
    <section id="about" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-balance mb-6">{t('publicPages.landing.about.title')}</h2>
          <p className="text-lg text-muted-foreground text-balance leading-relaxed">
            {t('publicPages.landing.about.intro')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{t('publicPages.landing.about.coursesTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('publicPages.landing.about.coursesText')}</p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{t('publicPages.landing.about.collaborationTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('publicPages.landing.about.collaborationText')}</p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{t('publicPages.landing.about.analyticsTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('publicPages.landing.about.analyticsText')}</p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{t('publicPages.landing.about.securityTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('publicPages.landing.about.securityText')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

export default AboutSection;


