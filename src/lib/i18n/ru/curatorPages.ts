import type { curatorPages as en } from '../en/curatorPages';
import type { RuTable } from '../types';

/**
 * Copied exactly from the pages (owner, Q24: curators see no change). The plurals below repeat
 * the one form the pages always printed («Выбрано 1 учеников» included) — fix them on purpose,
 * not as a side effect of the migration.
 */
export const curatorPages: RuTable<typeof en> = {
  'curatorPages.groups.title': 'Мои группы',
  'curatorPages.groups.searchPlaceholder': 'Поиск группы…',
  'curatorPages.groups.loadFailed': 'Не удалось загрузить группы',
  'curatorPages.groups.empty': 'У вас пока нет групп',
  'curatorPages.groups.nothingFound': 'Ничего не найдено',
  'curatorPages.groups.finished': 'Завершена',
  'curatorPages.groups.manageRoster': 'Управлять составом',

  'curatorPages.roster.loadFailed': 'Не удалось загрузить состав группы',
  'curatorPages.roster.saved': 'Состав обновлён: +{added} / −{removed}',
  'curatorPages.roster.saveFailed': 'Не удалось сохранить изменения состава',
  'curatorPages.roster.selected': {
    one: 'Выбрано {count} учеников',
    few: 'Выбрано {count} учеников',
    many: 'Выбрано {count} учеников',
    other: 'Выбрано {count} учеников',
  },
  'curatorPages.roster.pendingChanges': '{added} добавить, {removed} удалить',
  'curatorPages.roster.searchPlaceholder': 'Поиск ученика по имени или email…',
  'curatorPages.roster.hint': 'Отметьте, чтобы добавить в группу; снимите отметку у текущих — чтобы удалить.',
  'curatorPages.roster.searching': 'Поиск…',
  'curatorPages.roster.empty': 'В группе пока нет учеников. Найдите их через поиск выше.',
  'curatorPages.roster.member': 'в группе',
  'curatorPages.roster.saving': 'Сохранение',

  'curatorPages.parentReports.title': 'Отчёты родителям',
  'curatorPages.parentReports.previousWeek': 'Предыдущая неделя',
  'curatorPages.parentReports.nextWeek': 'Следующая неделя',
  'curatorPages.parentReports.noGroup': 'Откройте страницу с карточки группы — нужен параметр',
  'curatorPages.parentReports.loadFailed': 'Не удалось загрузить группу',
  'curatorPages.parentReports.bulkFailed': 'Не удалось выполнить массовую генерацию',
  'curatorPages.parentReports.loading': 'Загружаем…',
  'curatorPages.parentReports.generating': 'Генерируем…',
  'curatorPages.parentReports.generateMissing': 'Сгенерировать всем, у кого нет ({count})',
  'curatorPages.parentReports.readyCount': 'Готово {done} из {total}',
  'curatorPages.parentReports.failedCount': 'Не получилось: {count} — откройте карточку и попробуйте ещё раз',
  'curatorPages.parentReports.loadingRest': 'Догружаем данные учеников…',
  'curatorPages.parentReports.withTestSummary':
    'Тест за эту неделю есть у {withTest} из {loaded} — у остальных отчёт выйдет без результатов, прогресса и разбора навыков.',
  'curatorPages.parentReports.unknownTestSummary': 'По {count} — платформа не ответила, есть ли тест, неизвестно.',
  'curatorPages.parentReports.partlyMissingSummary':
    'У {count} тест есть по одному курсу и нет по другому — в их отчёт добавится просьба проконтролировать пропущенный.',
  'curatorPages.parentReports.loadingCard': 'Загружаем данные…',
  'curatorPages.parentReports.bulkCardFailed': 'Не удалось сгенерировать при массовом запуске',
  'curatorPages.parentReports.noTest': 'Теста за эту неделю нет — отчёт будет без результатов',
  'curatorPages.parentReports.testUnknown': 'Платформа не ответила — есть ли тест, неизвестно',
  'curatorPages.parentReports.missingTests': 'Нет теста по {courses} — отчёт попросит родителя проконтролировать',
  'curatorPages.parentReports.and': 'и',

  'curatorPages.curatorDetail.loading': 'Загрузка данных куратора...',
  'curatorPages.curatorDetail.notFound': 'Куратор не найден',
  'curatorPages.curatorDetail.backToDashboard': 'Назад к дашборду',
  'curatorPages.curatorDetail.students': 'Студентов',
  'curatorPages.curatorDetail.inGroups': {
    one: 'В {count} группах',
    few: 'В {count} группах',
    many: 'В {count} группах',
    other: 'В {count} группах',
  },
  'curatorPages.curatorDetail.overdue': 'Просрочено',
  'curatorPages.curatorDetail.overdueHomework': 'Просроченные задания',
  'curatorPages.curatorDetail.avgProgressShort': 'Ср. прогресс',
  'curatorPages.curatorDetail.avgProgress': 'Средний прогресс',
  'curatorPages.curatorDetail.overdueTrend': 'Тренды просрочек',
  'curatorPages.curatorDetail.overdueTrendHint': 'Новые просроченные задания за последние 30 дней',
  'curatorPages.curatorDetail.groupsAndStudents': 'Группы и студенты',
  'curatorPages.curatorDetail.groupsAndStudentsHint': 'Подробная информация о студентах каждой группы',
  'curatorPages.curatorDetail.noGroups': 'У этого куратора нет групп.',
  'curatorPages.curatorDetail.studentCount': {
    one: '{count} студентов',
    few: '{count} студентов',
    many: '{count} студентов',
    other: '{count} студентов',
  },
  'curatorPages.curatorDetail.overdueCount': '{count} просрочено',
  'curatorPages.curatorDetail.leaderboard': 'Лидерборд',
  'curatorPages.curatorDetail.noStudents': 'Студентов не найдено.',
  'curatorPages.curatorDetail.student': 'Студент',
  'curatorPages.curatorDetail.progress': 'Прогресс',

  'curatorPages.crmRedirect.onboardingTitle': 'Онбординг учеников — в CRM',
  'curatorPages.crmRedirect.tasksTitle': 'Задачи кураторов теперь в CRM',
  'curatorPages.crmRedirect.onboardingBody': 'Доска онбординга открывается в CRM. Вход по той же учётной записи.',
  'curatorPages.crmRedirect.tasksBody':
    'Заморозки, ОС, первые и последние уроки, даты и результаты экзаменов — один список в CRM. Вход по той же учётной записи.',
  'curatorPages.crmRedirect.openOnboarding': 'Открыть онбординг',
  'curatorPages.crmRedirect.openTasks': 'Перейти к задачам',
  'curatorPages.crmRedirect.fallback': 'Если переход не произошёл автоматически, нажмите кнопку выше.',
};
