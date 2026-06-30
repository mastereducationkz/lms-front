import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { forgotPassword } from '../../services/api/auth';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    try {
      await forgotPassword(email.trim());
    } catch {
      // Always succeed-looking (no user enumeration)
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        {sent ? (
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h1 className="text-lg font-semibold text-foreground">Проверьте почту</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Если аккаунт с адресом <strong>{email}</strong> существует, мы отправили ссылку для сброса пароля.
              Ссылка действительна 1 час.
            </p>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 mt-5 hover:underline">
              <ArrowLeft className="w-4 h-4" /> Вернуться ко входу
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h1 className="text-lg font-semibold text-foreground">Восстановление пароля</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Введите email — мы отправим ссылку для сброса пароля.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Отправка…</> : 'Отправить ссылку'}
              </Button>
            </form>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mt-5 hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> Вернуться ко входу
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
