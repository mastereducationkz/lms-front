import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { GraduationCap, Users, Settings } from "lucide-react";
import { useT } from "../../lib/i18n/react";
import '@/lib/i18n/catalogs/publicPages';

export function AudienceSection() {
  const t = useT();
  return (
    <section id="audience" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-balance mb-6">{t('publicPages.landing.audience.title')}</h2>
          <p className="text-lg text-muted-foreground text-balance leading-relaxed">
            {t('publicPages.landing.audience.intro')}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader className="pb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl">{t('publicPages.landing.audience.studentsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-2 text-left">
                <li>• {t('publicPages.landing.audience.studentsCourses')}</li>
                <li>• {t('publicPages.landing.audience.studentsLessons')}</li>
                <li>• {t('publicPages.landing.audience.studentsAssignments')}</li>
                <li>• {t('publicPages.landing.audience.studentsTeachers')}</li>
                <li>• {t('publicPages.landing.audience.studentsCalendar')}</li>
                <li>• {t('publicPages.landing.audience.studentsStats')}</li>
              </ul>
              <Button className="w-full mt-6">{t('publicPages.landing.startLearning')}</Button>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader className="pb-6">
              <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-accent" />
              </div>
              <CardTitle className="text-xl">{t('publicPages.landing.audience.teachersTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-2 text-left">
                <li>• {t('publicPages.landing.audience.teachersCourses')}</li>
                <li>• {t('publicPages.landing.audience.teachersBuilder')}</li>
                <li>• {t('publicPages.landing.audience.teachersGrading')}</li>
                <li>• {t('publicPages.landing.audience.teachersGroups')}</li>
                <li>• {t('publicPages.landing.audience.teachersAnalytics')}</li>
                <li>• {t('publicPages.landing.audience.teachersPlanning')}</li>
              </ul>
              <Button variant="outline" className="w-full mt-6 bg-transparent">
                {t('publicPages.landing.audience.teachersButton')}
              </Button>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader className="pb-6">
              <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Settings className="h-8 w-8 text-secondary-foreground" />
              </div>
              <CardTitle className="text-xl">{t('publicPages.landing.audience.adminsTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-2 text-left">
                <li>• {t('publicPages.landing.audience.adminsUsers')}</li>
                <li>• {t('publicPages.landing.audience.adminsAnalytics')}</li>
                <li>• {t('publicPages.landing.audience.adminsEvents')}</li>
                <li>• {t('publicPages.landing.audience.adminsConfig')}</li>
                <li>• {t('publicPages.landing.audience.adminsMonitoring')}</li>
                <li>• {t('publicPages.landing.audience.adminsReports')}</li>
              </ul>
              <Button variant="secondary" className="w-full mt-6">
                {t('publicPages.landing.audience.adminsButton')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

export default AudienceSection;


