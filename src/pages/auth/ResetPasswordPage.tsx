import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, KeyRound, ArrowLeft } from 'lucide-react';
import { resetPassword } from '../../services/api/auth';
import { toast } from '../../components/Toast';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password.length < 6) {
      toast('Пароль должен быть не короче 6 символов', 'error');
      return;
    }
    if (password !== confirm) {
      toast('Пароли не совпадают', 'error');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      toast('Пароль изменён. Войдите с новым паролем.', 'success');
      navigate('/login', { replace: true });
    } catch (err: any) {
      toast(err.message || 'Не удалось сбросить пароль', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h1 className="text-lg font-semibold text-foreground">Новый пароль</h1>
        </div>

        {!token ? (
          <>
            <p className="text-sm text-muted-foreground mt-2">
              Ссылка недействительна или устарела. Запросите новую.
            </p>
            <Link to="/forgot-password" className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 mt-5 hover:underline">
              <ArrowLeft className="w-4 h-4" /> Запросить ссылку заново
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-5">Придумайте новый пароль для вашего аккаунта.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password" className="text-sm font-medium">Новый пароль</Label>
                <Input
                  id="password"
                  type="password"
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="confirm" className="text-sm font-medium">Повторите пароль</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Сохранение…</> : 'Сменить пароль'}
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
