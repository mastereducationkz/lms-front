import type { curatorHomeworks as en } from '../en/curatorHomeworks';
import type { RuTable } from '../types';

// Curators keep exactly the wording they had, so some counts stay in one form («групп», «заданий», «студентов»).
export const curatorHomeworks: RuTable<typeof en> = {
  'curatorHomeworks.title': 'Домашние задания',
  'curatorHomeworks.loadError': 'Не удалось загрузить домашние задания',
  'curatorHomeworks.teacherFallback': 'Учитель #{id}',
  'curatorHomeworks.allGroups': 'Все группы',

  'curatorHomeworks.stats.groups': { one: 'групп', few: 'групп', many: 'групп', other: 'групп' },
  'curatorHomeworks.stats.assignments': { one: 'заданий', few: 'заданий', many: 'заданий', other: 'заданий' },
  'curatorHomeworks.stats.submitted': 'сдано',
  'curatorHomeworks.stats.notSubmitted': 'не сдано',
  'curatorHomeworks.stats.overdue': 'просрочено',

  'curatorHomeworks.count.overdue': '{count} просрочено',
  'curatorHomeworks.count.notSubmitted': '{count} не сдано',
  'curatorHomeworks.count.allSubmitted': 'всё сдано',
  'curatorHomeworks.count.submittedOf': '{submitted}/{expected} сдано',
  'curatorHomeworks.count.inReview': '{count} на проверке',
  'curatorHomeworks.count.graded': '{graded}/{submitted} оценено',

  'curatorHomeworks.group.finished': 'Завершена',
  'curatorHomeworks.group.assignments': { one: '{count} заданий', few: '{count} заданий', many: '{count} заданий', other: '{count} заданий' },
  'curatorHomeworks.group.students': { one: '{count} студентов', few: '{count} студентов', many: '{count} студентов', other: '{count} студентов' },
  'curatorHomeworks.group.noAssignments': 'В этой группе нет заданий',
  'curatorHomeworks.group.empty': 'Нет заданий',

  'curatorHomeworks.table.assignment': 'Задание',
  'curatorHomeworks.table.due': 'Срок',
  'curatorHomeworks.table.sortByDue': 'Сортировать по сроку',
  'curatorHomeworks.table.submitted': 'Сдано',
  'curatorHomeworks.assignment.due': 'Срок: {date}',

  'curatorHomeworks.empty.title': 'Нет домашних заданий',
  'curatorHomeworks.empty.hint': 'Задания ваших групп появятся здесь',

  'curatorHomeworks.filter.searchGroups': 'Поиск группы...',
  'curatorHomeworks.filter.teacher': 'Учитель',
  'curatorHomeworks.filter.allTeachers': 'Все учителя',
  'curatorHomeworks.filter.needsAttention': 'Только отстающие',
  'curatorHomeworks.filter.showFinished': 'Показывать завершенные группы',
  'curatorHomeworks.filter.allOnTrack': 'Все группы в порядке',
  'curatorHomeworks.filter.nothingFound': 'Ничего не найдено',
  'curatorHomeworks.filter.searchStudents': 'Поиск по имени студента...',
  'curatorHomeworks.filter.status': 'Статус',
  'curatorHomeworks.filter.graded': 'Оценено',

  'curatorHomeworks.students.noneInAssignment': 'В этом задании нет студентов',
  'curatorHomeworks.students.noneMatch': 'Нет студентов, подходящих под фильтры',
  'curatorHomeworks.students.student': 'Студент',
  'curatorHomeworks.students.submittedAt': 'Сдано в',
  'curatorHomeworks.students.status': 'Статус',
  'curatorHomeworks.students.actions': 'Действия',
  'curatorHomeworks.students.view': 'Смотреть',
};
