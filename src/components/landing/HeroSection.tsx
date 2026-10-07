import React, { useState, useEffect } from "react";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "../ui/button";
import LogoIcon from '../../assets/masteredlogo-ico.ico';
import { formatNumber } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/publicPages';

export function HeroSection() {
  const t = useT();
  const [counts, setCounts] = useState({
    students: 0,
    teachers: 0,
    courses: 0,
    satisfaction: 0
  });

  // Typing animation state
  const staticPrefix = t('publicPages.landing.hero.prefix');
  const phrases = [
    t('publicPages.landing.hero.phraseSat'),
    t('publicPages.landing.hero.phraseIelts'),
    t('publicPages.landing.hero.phraseUni'),
  ];
  const [activeIndex, setActiveIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const targetCounts = {
    students: 1102,
    teachers: 51,
    courses: 5,
    satisfaction: 95
  };

  useEffect(() => {
    const duration = 2000; // 2 seconds
    const steps = 60; // 60 steps for smooth animation
    const stepDuration = duration / steps;

    const animateCount = (key: keyof typeof targetCounts) => {
      const target = targetCounts[key];
      const increment = target / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        setCounts(prev => ({ ...prev, [key]: Math.floor(current) }));
      }, stepDuration);
    };

    // Start animation after a small delay
    const timeout = setTimeout(() => {
      Object.keys(targetCounts).forEach(key => {
        animateCount(key as keyof typeof targetCounts);
      });
    }, 500);

    return () => clearTimeout(timeout);
  }, []);

  // Typing effect (types only the variable part, keeps static prefix)
  useEffect(() => {
    const current = phrases[activeIndex];

    // Typing speed configs (ms)
    const typeSpeed = 50;
    const deleteSpeed = 28;
    const holdAfterType = 2000; // pause after full phrase
    const holdBetween = 200;    // pause before next phrase starts

    if (!isDeleting && typed.length < current.length) {
      const t = setTimeout(() => setTyped(current.slice(0, typed.length + 1)), typeSpeed);
      return () => clearTimeout(t);
    }

    if (!isDeleting && typed.length === current.length) {
      const hold = setTimeout(() => setIsDeleting(true), holdAfterType);
      return () => clearTimeout(hold);
    }

    if (isDeleting && typed.length > 0) {
      const t = setTimeout(() => setTyped(current.slice(0, typed.length - 1)), deleteSpeed);
      return () => clearTimeout(t);
    }

    if (isDeleting && typed.length === 0) {
      const next = setTimeout(() => {
        setIsDeleting(false);
        setActiveIndex((prev) => (prev + 1) % phrases.length);
      }, holdBetween);
      return () => clearTimeout(next);
    }
  }, [typed, isDeleting, activeIndex, phrases]);
  return (
    <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />

      <div className="container mx-auto px-4 relative">
        <div className="max-w-4xl mx-auto text-center mt-32">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8">
            <img src={LogoIcon} alt="Master Education" className="h-6 w-6 object-contain" />
            {t('publicPages.landing.hero.badge')}
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-balance mb-6 leading-tight">
            <span className="block min-h-[6rem] md:min-h-[8rem] lg:min-h-[9rem] whitespace-pre-line">
              {staticPrefix}
              <span className="text-primary">{typed}</span>
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground text-balance mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('publicPages.landing.hero.tagline')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button asChild size="lg" className="text-base px-8">
              <a href="/login">
                {t('publicPages.landing.hero.consultation')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base px-8 bg-transparent">
              <a href="/login">
                <Play className="mr-2 h-4 w-4" />
                {t('publicPages.landing.startLearning')}
              </a>
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-12 border-t border-border">
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary mb-2">{formatNumber(counts.students)}+</div>
              <div className="text-sm text-muted-foreground">{t('publicPages.landing.hero.activeStudents')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary mb-2">{counts.teachers}+</div>
              <div className="text-sm text-muted-foreground">{t('publicPages.landing.hero.teachers')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary mb-2">{counts.courses}+</div>
              <div className="text-sm text-muted-foreground">{t('publicPages.landing.hero.courses')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary mb-2">{counts.satisfaction}%</div>
              <div className="text-sm text-muted-foreground">{t('publicPages.landing.hero.satisfaction')}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;


