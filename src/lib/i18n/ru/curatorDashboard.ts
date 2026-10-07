import type { curatorDashboard as en } from '../en/curatorDashboard';
import type { RuTable } from '../types';

export const curatorDashboard: RuTable<typeof en> = {
  'curatorDashboard.greeting': 'Рады видеть вас, {name}!',
  'curatorDashboard.subtitle.headCurator': 'Обзор эффективности кураторов и активности студентов',
  'curatorDashboard.subtitle.curator': 'Обзор успеваемости ваших групп и активности студентов',
  'curatorDashboard.updating': 'Обновление данных...',
  'curatorDashboard.filter.allGroups': 'Все группы',
  'curatorDashboard.period.pick': 'Выберите период',
  'curatorDashboard.period.presets': 'Периоды',
  'curatorDashboard.period.allTime': 'Весь период',

  'curatorDashboard.attendance.missing': 'Посещаемость не заполнена ({count})',
  'curatorDashboard.attendance.open': 'Перейти к посещаемости',
  'curatorDashboard.attendance.fill': 'Заполнить',

  'curatorDashboard.kpi.totalCurators': 'Всего кураторов',
  'curatorDashboard.kpi.totalGroups': 'Всего групп',
  'curatorDashboard.kpi.activeOnPlatform': 'Активных на платформе',
  'curatorDashboard.kpi.assignedToYou': 'Прикреплено к вам',
  'curatorDashboard.kpi.totalStudents': 'Студентов всего',
  'curatorDashboard.kpi.active7d': {
    one: '{count} активен за 7д',
    few: '{count} активны за 7д',
    many: '{count} активны за 7д',
    other: '{count} активны за 7д',
  },
  'curatorDashboard.kpi.overdueHomework': 'Просрочено ДЗ',
  'curatorDashboard.kpi.needsAttention': 'Требует внимания',
  'curatorDashboard.kpi.inactive': 'Неактивных',
  'curatorDashboard.kpi.inactiveFor7d': 'Бездействуют на протяжении 7 дней',

  'curatorDashboard.chart.activity': 'Активность студентов (%)',
  'curatorDashboard.chart.activityTooltip': 'Активность',
  'curatorDashboard.chart.curatorPerformance': 'Эффективность кураторов (%)',
  'curatorDashboard.chart.groupProgress': 'Прогресс по группам (%)',
  'curatorDashboard.chart.curatorPerformanceHint': 'Эффективность рассчитывается на основе среднего прогресса студентов, отсутствия просрочек и скорости проверки работ.',
  'curatorDashboard.chart.groupProgressHint': 'Средний прогресс освоения курсов студентами в каждой группе.',
  'curatorDashboard.chart.avgProgress': 'Ср. прогресс (%)',

  'curatorDashboard.table.byCurator': 'Сводная таблица по кураторам',
  'curatorDashboard.table.byGroup': 'Сводная таблица по группам',
  'curatorDashboard.table.curator': 'Куратор',
  'curatorDashboard.table.group': 'Группа',
  'curatorDashboard.table.groups': 'Группы',
  'curatorDashboard.table.students': 'Студенты',
  'curatorDashboard.table.avgProgress': 'Ср. прогресс',
  'curatorDashboard.table.overdue': 'Просрочено',
  'curatorDashboard.table.pendingGrading': 'На проверке',
  'curatorDashboard.table.actions': 'Действия',
  'curatorDashboard.table.ofTotal': 'из {total} ({percent}%)',
  'curatorDashboard.table.view': 'Обзор',

  'curatorDashboard.atRisk.title': 'Группы с просрочками',
  'curatorDashboard.atRisk.description': 'Здесь отображаются группы, в которых есть студенты с невыполненными вовремя заданиями или заданиями, сданными после дедлайна.',
  'curatorDashboard.atRisk.empty': 'Проблемных групп не обнаружено. Все задания под контролем!',
};
