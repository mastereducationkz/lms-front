import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './ui/input';
import { isOidcConfigured, startOidcLogin } from '../services/oidc';


// --- TYPE DEFINITIONS ---

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogleSignIn?: () => void;
  onResetPassword?: () => void;
  onCreateAccount?: () => void;
  onBackToHome?: () => void;
  error?: string;
  loading?: boolean;
}

// --- SUB-COMPONENTS ---

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
    {children}
  </div>
);

const TestimonialCard = ({ testimonial, delay }: { testimonial: Testimonial, delay: string }) => (
  <div className={`animate-testimonial ${delay} flex items-start gap-3 rounded-3xl bg-card/40 dark:bg-zinc-800/40 backdrop-blur-xl border border-white/10 p-5 w-64`}>
    <img src={testimonial.avatarSrc} className="h-10 w-10 object-cover rounded-2xl" alt="avatar" />
    <div className="text-sm leading-snug">
      <p className="flex items-center gap-1 font-medium">{testimonial.name}</p>
      <p className="text-muted-foreground">{testimonial.handle}</p>
      <p className="mt-1 text-foreground/80">{testimonial.text}</p>
    </div>
  </div>
);

// --- MAIN COMPONENT ---

export const SignInPage: React.FC<SignInPageProps> = ({
  title = <span className="font-light text-foreground tracking-tighter">Welcome</span>,
  description = "Access your account and continue your journey with us",
  heroImageSrc,
  testimonials = [],
  onSignIn,
  onGoogleSignIn,
  onResetPassword,
  onCreateAccount,
  onBackToHome,
  error,
  loading = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  // SSO ("Continue with Master Education") is the primary path. The email/password form is the
  // only path when SSO isn't configured (local dev), otherwise it's revealed on demand as a
  // reversible break-glass fallback — the backend still accepts both.
  const oidcEnabled = isOidcConfigured();
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const passwordFormVisible = !oidcEnabled || showPasswordLogin;

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row font-geist w-[100dvw]">
      {/* Left column: sign-in form */}
      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight">{title}</h1>
            <p className="animate-element animate-delay-200 text-muted-foreground">{description}</p>

            {error && (
              <div className="animate-element animate-delay-250 -mb-2 p-3 text-sm text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded">
                {error}
              </div>
            )}

            {/* Primary path: Continue with Master Education (SSO). */}
            {oidcEnabled && (
              <div className="animate-element animate-delay-300 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void startOidcLogin();
                  }}
                  disabled={loading}
                  className="w-full rounded bg-primary py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Продолжить с Master Education
                </button>
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      void startOidcLogin({ selectAccount: true });
                    }}
                    disabled={loading}
                    className="text-muted-foreground underline transition-colors hover:text-foreground"
                  >
                    Войти под другим аккаунтом
                  </button>
                  {!passwordFormVisible && (
                    <>
                      <span className="text-muted-foreground/50">·</span>
                      <button
                        type="button"
                        onClick={() => setShowPasswordLogin(true)}
                        disabled={loading}
                        className="text-muted-foreground underline transition-colors hover:text-foreground"
                      >
                        Другие способы входа
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Email/password — the only path when SSO isn't configured, otherwise revealed on
                demand as a break-glass fallback. The backend still accepts both. */}
            {passwordFormVisible && (
              <div className="animate-element animate-delay-400 flex flex-col gap-5">
                {oidcEnabled && (
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">или по паролю</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}

                <form className="space-y-5" onSubmit={onSignIn}>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                    <GlassInputWrapper>
                      <Input
                        name="email"
                        type="email"
                        placeholder="Enter your email address"
                        className="w-full bg-white dark:bg-card text-lg p-4 focus:outline-none "
                        required
                        disabled={loading}
                      />
                    </GlassInputWrapper>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Password</label>
                    <GlassInputWrapper>
                      <div className="relative">
                        <Input
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          className="w-full bg-white dark:bg-card text-lg p-4 focus:outline-none"
                          required
                          disabled={loading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-3 flex items-center"
                          disabled={loading}
                        >
                          {showPassword ? <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" /> : <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />}
                        </button>
                      </div>
                    </GlassInputWrapper>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" name="rememberMe" className="custom-checkbox" disabled={loading} />
                      <span className="text-foreground/90">Keep me signed in</span>
                    </label>
                    <Link to="/forgot-password" className="text-primary hover:underline">
                      Forgot your password?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full rounded py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${oidcEnabled ? 'border border-input bg-background text-foreground hover:bg-accent' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                  >
                    {loading ? 'Signing In...' : 'Sign In'}
                  </button>
                </form>
              </div>
            )}

            {onBackToHome && (
              <div className="animate-element animate-delay-950 mt-4 text-center">
                <button 
                  onClick={onBackToHome}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
                >
                  ← Back to Home
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Right column: hero image + testimonials */}
      {heroImageSrc && (
        <section className="hidden md:block flex-1 relative p-4">
          <div className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center" style={{ backgroundImage: `url(${heroImageSrc})` }}>
            <div className="absolute inset-0 rounded-3xl bg-black/0 dark:bg-black/30 transition-colors" />
          </div>
          {testimonials.length > 0 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-8 w-full justify-center">
              <TestimonialCard testimonial={testimonials[0]} delay="animate-delay-1000" />
              {testimonials[1] && <div className="hidden xl:flex"><TestimonialCard testimonial={testimonials[1]} delay="animate-delay-1200" /></div>}
              {testimonials[2] && <div className="hidden 2xl:flex"><TestimonialCard testimonial={testimonials[2]} delay="animate-delay-1400" /></div>}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
