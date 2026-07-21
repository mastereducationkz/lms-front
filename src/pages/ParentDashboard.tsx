import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, MessageCircle, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { getMyChildren, type ParentChild } from '../services/api';
import Skeleton from '../components/Skeleton.tsx';

export default function ParentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<ParentChild[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const data = await getMyChildren();
      if (active) {
        setChildren(data);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'Родитель';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">Здравствуйте, {firstName}!</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Здесь ваши дети и связь с их учителями и кураторами.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" /> Мои дети
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="card p-5">
                <Skeleton className="h-6 w-40 mb-3" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        ) : children.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map((child) => (
              <div key={child.id} className="card p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold">
                    {child.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-foreground truncate">{child.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate">
                      <GraduationCap className="w-4 h-4 shrink-0" />
                      {child.group_name || 'Без группы'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center text-gray-500 dark:text-gray-400">
            Пока нет привязанных детей. Обратитесь к администратору, чтобы связать ваш аккаунт с ребёнком.
          </div>
        )}
      </section>

      <section>
        <div className="card p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-foreground">Связь с учителями и кураторами</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Пишите напрямую или в родительских чатах групп вашего ребёнка.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/chat')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0"
          >
            Открыть чат
          </button>
        </div>
      </section>
    </div>
  );
}
