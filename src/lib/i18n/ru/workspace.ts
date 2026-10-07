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
};
