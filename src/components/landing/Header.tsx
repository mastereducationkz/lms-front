import React from 'react';
import { Menu, X } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import LogoIcon from '../../assets/masteredlogo-ico.ico';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/publicPages';

export function Header() {
  const t = useT();
  const [menuState, setMenuState] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);

  const menuItems = [
    { name: t('publicPages.landing.nav.about'), href: "#about" },
    { name: t('publicPages.landing.nav.features'), href: "#features" },
    { name: t('publicPages.landing.nav.audience'), href: "#audience" },
    { name: t('publicPages.landing.nav.benefits'), href: "#benefits" },
  ];

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header>
      <nav className="fixed z-50 w-full px-1 -2 mb-2 ">
        <div className={cn(
          'mx-auto mt-2 max-w-6xl px-6 transition-all duration-300 lg:px-12 z-50',
          isScrolled && 'bg-background/50 max-w-5xl rounded-xl border backdrop-blur-lg lg:px-5 shadow-sm'
        )}>
          <div className="relative flex flex-wrap items-center justify-between gap-6 py-2 lg:gap-0 lg:py-2">
            <div className="flex w-full justify-between lg:w-auto">
              <a
                href="/"
                aria-label={t('publicPages.landing.nav.home')}
                className="flex items-center space-x-2"
              >
                <div className="h-10 w-10 rounded-lg flex items-center justify-center overflow-hidden">
                  <img src={LogoIcon} alt="Master Education" className="h-10 w-10 object-contain" />
                </div>
                <span className="text-2xl font-bold text-primary">Master Education</span>
              </a>

              <button
                onClick={() => setMenuState(!menuState)}
                aria-label={menuState ? t('publicPages.landing.nav.closeMenu') : t('publicPages.landing.nav.openMenu')}
                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden"
              >
                <Menu className={cn(
                  "m-auto size-6 duration-200",
                  menuState && "rotate-180 scale-0 opacity-0"
                )} />
                <X className={cn(
                  "absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200",
                  menuState && "rotate-0 scale-100 opacity-100"
                )} />
              </button>
            </div>

            <div className="absolute inset-0 m-auto hidden size-fit lg:block">
              <ul className="flex gap-6 text-sm">
                {menuItems.map((item, index) => (
                  <li key={index}>
                    <a
                      href={item.href}
                      className="text-muted-foreground hover:text-accent-foreground block duration-150"
                    >
                      <span>{item.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className={cn(
              "bg-background mb-2 w-full flex-wrap items-center justify-end space-y-4 rounded-xl border p-4 shadow-sm md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-4 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent",
              menuState ? "block" : "hidden",
              "lg:flex"
            )}>
              <div className="lg:hidden">
                <ul className="space-y-4 text-base">
                  {menuItems.map((item, index) => (
                    <li key={index}>
                      <a
                        href={item.href}
                        className="text-muted-foreground hover:text-accent-foreground block duration-150"
                      >
                        <span>{item.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex w-full flex-col space-y-2 sm:flex-row sm:gap-2 sm:space-y-0 md:w-fit items-center">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={cn(isScrolled && 'lg:hidden')}
                >
                  <a href="/login">{t('publicPages.landing.signIn')}</a>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className={cn('bg-primary text-primary-foreground', isScrolled && 'lg:hidden')}
                >
                  <a href="/login">{t('publicPages.landing.startLearning')}</a>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className={cn('bg-primary text-primary-foreground', isScrolled ? 'lg:inline-flex' : 'hidden')}
                >
                  <a href="/login">{t('publicPages.landing.getStarted')}</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}

export default Header;


