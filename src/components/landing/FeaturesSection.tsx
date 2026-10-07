import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Video, FileText, MessageCircle, Calendar, TrendingUp, Users2, Settings, Award } from "lucide-react";
import { useT } from "../../lib/i18n/react";
import '@/lib/i18n/catalogs/publicPages';

export function FeaturesSection() {
  const t = useT();
  const features = [
    { icon: Video, title: t('publicPages.landing.features.videoTitle'), description: t('publicPages.landing.features.videoText') },
    { icon: FileText, title: t('publicPages.landing.features.assignmentsTitle'), description: t('publicPages.landing.features.assignmentsText') },
    { icon: MessageCircle, title: t('publicPages.landing.features.chatTitle'), description: t('publicPages.landing.features.chatText') },
    { icon: Calendar, title: t('publicPages.landing.features.calendarTitle'), description: t('publicPages.landing.features.calendarText') },
    { icon: TrendingUp, title: t('publicPages.landing.features.progressTitle'), description: t('publicPages.landing.features.progressText') },
    { icon: Users2, title: t('publicPages.landing.features.groupsTitle'), description: t('publicPages.landing.features.groupsText') },
    { icon: Settings, title: t('publicPages.landing.features.builderTitle'), description: t('publicPages.landing.features.builderText') },
    { icon: Award, title: t('publicPages.landing.features.gradingTitle'), description: t('publicPages.landing.features.gradingText') },
  ];

  return (
    <section id="features" className="py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-balance mb-6">{t('publicPages.landing.features.title')}</h2>
          <p className="text-lg text-muted-foreground text-balance leading-relaxed">
            {t('publicPages.landing.features.intro')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeaturesSection;


