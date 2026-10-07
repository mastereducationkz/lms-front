import { Card, CardContent } from "../ui/card";
import { Star, Quote } from "lucide-react";
import { useT } from "../../lib/i18n/react";
import '@/lib/i18n/catalogs/publicPages';

export function TestimonialsSection() {
  const t = useT();
  const testimonials = [
    {
      name: "Bekzhan Yerlanov",
      role: t('publicPages.landing.testimonials.roleSatStudent'),
      content: t('publicPages.landing.testimonials.quoteSat'),
      rating: 5,
      avatar: "SJ"
    },
    {
      name: "Ruslan Zainullin",
      role: t('publicPages.landing.testimonials.roleIeltsStudent'),
      content: t('publicPages.landing.testimonials.quoteIelts'),
      rating: 5,
      avatar: "AR"
    },
    {
      name: "Rakhat Zhanibekov",
      role: t('publicPages.landing.testimonials.roleAdmissionsStudent'),
      content: t('publicPages.landing.testimonials.quoteAdmissions'),
      rating: 5,
      avatar: "MG"
    },
    {
      name: "Shyngys Baurzhanov",
      role: t('publicPages.landing.testimonials.roleParent'),
      content: t('publicPages.landing.testimonials.quoteParent'),
      rating: 5,
      avatar: "DC"
    },
    {
      name: "Rustem Zhumashev",
      role: t('publicPages.landing.testimonials.roleTeacher'),
      content: t('publicPages.landing.testimonials.quoteTeacher'),
      rating: 5,
      avatar: "ER"
    },
    {
      name: "Ruslan Zainullin",
      role: t('publicPages.landing.testimonials.roleSatTeacher'),
      content: t('publicPages.landing.testimonials.quoteSatTeacher'),
      rating: 5,
      avatar: "JW"
    }
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-balance mb-6">{t('publicPages.landing.testimonials.title')}</h2>
          <p className="text-lg text-muted-foreground text-balance leading-relaxed">
            {t('publicPages.landing.testimonials.intro')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                
                <Quote className="h-6 w-6 text-primary/20 mb-4" />
                
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  "{testimonial.content}"
                </p>
                
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">{testimonial.avatar}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{testimonial.name}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSection;
