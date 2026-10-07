import type { analytics as en } from '../en/analytics';
import type { RuTable } from '../types';

export const analytics: RuTable<typeof en> = {
  'analytics.title': 'Аналитика',
  'analytics.subtitle': 'Отслеживание прогресса студентов и эффективности курсов',
  'analytics.selectCourse': 'Выберите курс',
  'analytics.filterByGroup': 'Фильтр по группе',
  'analytics.allGroups': 'Все группы',

  'analytics.stats.totalStudents': 'Всего студентов',
  'analytics.stats.avgProgress': 'Средний прогресс',
  'analytics.stats.avgScore': 'Средний балл',
  'analytics.stats.completionRate': 'Процент завершения',

  'analytics.tabs.overview': 'Обзор',
  'analytics.tabs.students': 'Студенты',
  'analytics.tabs.groups': 'Группы',
  'analytics.tabs.quizzes': 'Тесты',
  'analytics.tabs.topics': 'Темы',
  'analytics.tabs.engagement': 'Активность',

  'analytics.students.searchPlaceholder': 'Поиск: имя или email…',
  'analytics.students.includeDeactivated': 'Деактивированные студенты',
  'analytics.students.deactivated': 'деактивирован',
  'analytics.groups.searchPlaceholder': 'Поиск группы…',
  'analytics.groups.showArchived': 'Архивные группы',
  'analytics.groups.archived': 'архив',

  'analytics.student.back': 'Назад к аналитике',
  'analytics.student.details': 'Детали студента',
  'analytics.student.progressReport': 'Отчёт об успеваемости',
  'analytics.student.totalStudyTime': 'Общее время обучения',
  'analytics.student.progress': 'Прогресс',
  'analytics.student.lastActivity': 'Последняя активность',
  'analytics.student.enrollmentStatus': 'Статус зачисления',
  'analytics.student.tabs.performance': 'Успеваемость',
  'analytics.student.tabs.curriculum': 'Учебный план',
  'analytics.student.tabs.homework': 'Домашние задания',
  'analytics.student.tabs.history': 'История',
};
