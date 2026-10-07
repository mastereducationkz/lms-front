import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/courseAuthoring';

interface CardProps {
  image?: string;
  title: string;
  description?: string;
  teacher?: string;
  duration?: number;
  level?: string;
  rating?: number;
  students?: number;
  actionText?: string;
  onAction?: () => void;
}

export default function Card({
  image,
  title,
  description,
  teacher,
  duration,
  level,
  rating,
  students,
  actionText,
  onAction
}: CardProps) {
  const t = useT();

  return (
    <div className="card p-6 flex flex-col">
      {image && (
        <img
          src={image}
          alt={title}
          className="w-full h-44 object-cover rounded-xl mb-4"
        />
      )}

      <h3 className="text-2xl font-semibold mb-2">{title}</h3>

      {description && (
        <p className="text-gray-600 text-sm mb-4">{description}</p>
      )}

      <div className="flex items-center text-gray-800 text-sm space-x-4 mb-4">
        {teacher && <span>{t('courseAuthoring.card.byTeacher', { teacher })}</span>}
        {duration && <span>{t('courseAuthoring.card.weeks', { count: duration })}</span>}
      </div>

      {}
      {level && (
        <div className="mb-4">
          <span className="text-xs font-medium text-blue-800">{level}</span>
          <div className="w-full bg-blue-100 rounded-full h-2 mt-1">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${rating ? (rating/5)*100 : 0}%` }} 
            />
          </div>
        </div>
      )}

      {}
      {rating && (
        <div className="flex items-center space-x-1 text-yellow-500 mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 inline-block"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M9.049 2.927C9.324 2.07 10.676 2.07 10.951 2.927l.805 2.469a1 1 0 00.95.69h2.593c.969 0 1.371 1.24.588 1.81l-2.096 1.523a1 1 0 00-.364 1.118l.805 2.469c.275.857-.688 1.57-1.404 1.118L10 11.347l-2.422 1.748c-.716.452-1.679-.261-1.404-1.118l.805-2.469a1 1 0 00-.364-1.118L4.519 7.896c-.783-.57-.38-1.81.588-1.81h2.593a1 1 0 00.95-.69l.805-2.469z" />
          </svg>
          <span className="text-sm font-semibold">{rating.toFixed(1)}</span>
        </div>
      )}

      {students && (
        <p className="text-gray-600 text-xs mb-6">{t('courseAuthoring.card.studentsEnrolled', { count: students })}</p>
      )}

      {actionText && (
        <button
          onClick={onAction}
          className="mt-auto self-start bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-xl transition"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
