import type { workspace as en } from '../en/workspace';
import type { RuTable } from '../types';

export const workspace: RuTable<typeof en> = {
  'workspace.instructions.greeting': 'Здравствуйте!',
  'workspace.instructions.greetingNamed': 'Здравствуйте, {name}!',
  'workspace.instructions.intro': 'Для ваших уроков создан рабочий Google-аккаунт Master Education:',
  'workspace.instructions.address': 'Адрес: {email}',
  'workspace.instructions.password': 'Временный пароль: ________',
  'workspace.instructions.signIn': '1. До ближайшего урока откройте https://accounts.google.com, войдите как {email} и задайте свой пароль. Пока вы ни разу не вошли, Google не считает вас сотрудником школы — и урок не запишется.',
  'workspace.instructions.join': '2. На урок заходите кнопкой «Join» в LMS: ссылка сама откроет Meet под рабочим аккаунтом. Если Google спросит, какой аккаунт использовать, выберите {email}, а не личный.',
  'workspace.instructions.recording': '3. Запись включается сама, нажимать ничего не нужно. Записи ваших уроков появятся в LMS в разделе Lesson Recordings.',

  // Admin → Recordings rollout: why a pending teacher can't be imported or connected yet (lib/workspaceRollout).
  'workspace.rollout.addressEmpty': 'Введите адрес в Workspace',
  'workspace.rollout.addressDomain': 'Адрес должен заканчиваться на @{domain}',
  'workspace.rollout.addressInvalid': 'Недопустимое имя почтового ящика',
  'workspace.rollout.firstNameEmpty': 'Имя не заполнено',
  'workspace.rollout.lastNameEmpty': 'Фамилия не заполнена',
  'workspace.rollout.firstNameTooLong': 'Имя длиннее {max} символов',
  'workspace.rollout.lastNameTooLong': 'Фамилия длиннее {max} символов',
  'workspace.rollout.firstNameLatin': 'Имя нужно написать латиницей',
  'workspace.rollout.lastNameLatin': 'Фамилию нужно написать латиницей',
  'workspace.rollout.alreadyConnected': 'Адрес уже привязан к другому преподавателю: {name}',
  'workspace.rollout.uploadListFirst': 'Сначала загрузите список пользователей Workspace',
  'workspace.rollout.suspended': 'Этот аккаунт заблокирован в Google Workspace',
};
