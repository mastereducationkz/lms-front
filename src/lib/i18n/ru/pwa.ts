import type { pwa as en } from '../en/pwa';
import type { RuTable } from '../types';

export const pwa: RuTable<typeof en> = {
  'pwa.appName': 'Master LMS',

  // Dashboard card
  'pwa.cardTitlePhone': 'Master LMS на телефоне',
  'pwa.cardTitleComputer': 'Установите Master LMS на компьютер',
  'pwa.cardTitleInApp': 'Master LMS как приложение',
  'pwa.cardBody': 'Напоминание перед каждым уроком и домашка в одно касание.',
  'pwa.cardBodyComputer': 'Открывается из дока или панели задач, с напоминаниями перед уроками.',
  'pwa.cardBodyInApp': 'Откройте страницу в браузере, чтобы установить: напоминания перед уроками и домашка в одно касание.',
  'pwa.teacherLine': 'Установите Master LMS: открывается в одно касание и напоминает об уроках.',
  'pwa.install': 'Установить',
  'pwa.installApp': 'Установить приложение',
  'pwa.showMeHow': 'Как установить',
  'pwa.notNow': 'Не сейчас',

  // Reminders card (inside the installed app)
  'pwa.pushTitle': 'Включите напоминания об уроках',
  'pwa.pushBody': 'Мы напомним перед началом каждого урока, чтобы вы не опаздывали.',
  'pwa.turnOn': 'Включить',
  'pwa.pushOnToast': 'Напоминания включены',
  'pwa.pushBlockedToast': 'Уведомления запрещены. Их можно разрешить в настройках.',

  // Sheet: iPhone/iPad
  'pwa.iosTitle': 'Добавьте Master LMS на экран «Домой»',
  'pwa.iosLead': 'Откроется как приложение и сможет напоминать об уроках.',
  'pwa.iosStepShareMore': 'Нажмите {more} внизу Safari, затем {share}.',
  'pwa.iosStepShare': 'Нажмите {share} на панели Safari.',
  'pwa.iosStepShareTop': 'Нажмите {share} вверху экрана.',
  'pwa.iosStepShareChrome': 'Нажмите {share} в адресной строке.',
  'pwa.iosStepAdd': 'Пролистайте вниз и нажмите {add}.',
  'pwa.iosStepConfirm': 'Нажмите «Добавить» в правом верхнем углу.',
  'pwa.iosStepConfirmWebApp': 'Оставьте «Открывать как веб-приложение» включённым и нажмите «Добавить».',
  'pwa.more': 'Ещё',
  'pwa.share': 'Поделиться',
  'pwa.addToHomeScreen': 'На экран «Домой»',
  'pwa.copy': 'Скопировать',
  'pwa.addBookmark': 'Добавить закладку',
  'pwa.toolbarHint': 'Панель Safari прямо под этим окном',
  'pwa.gotIt': 'Понятно',
  'pwa.alreadyAdded': 'Уже на экране «Домой»',

  // Sheet: in-app browser ({browser} is Safari or Chrome, {app} the app's name)
  'pwa.inAppTitle': 'Откройте Master LMS в {browser}',
  'pwa.inAppLeadNamed': 'Встроенный браузер {app} не умеет устанавливать приложения. Откройте страницу в {browser}, затем добавьте её на экран «Домой».',
  'pwa.inAppLead': 'Встроенный браузер этого приложения не умеет устанавливать приложения. Откройте страницу в {browser}, затем добавьте её на экран «Домой».',
  'pwa.inAppStepOpen': 'Выберите «Открыть в {browser}» (или «Открыть в браузере»).',
  'pwa.inAppStepMenu': 'Нажмите {more} в углу экрана.',
  'pwa.inAppOr': 'Или скопируйте ссылку и вставьте её в адресную строку:',
  'pwa.copyLink': 'Скопировать ссылку',
  'pwa.copied': 'Скопировано',
  'pwa.menu': 'Меню',

  // Sheet: Android / computer without the one-tap prompt
  'pwa.manualTitle': 'Установите Master LMS',
  'pwa.manualLeadAndroid': 'Браузер может добавить Master LMS на главный экран как приложение.',
  'pwa.manualLeadDesktop': 'Chrome и Edge могут установить Master LMS на этот компьютер как приложение.',
  'pwa.manualStepAndroid': 'Откройте меню браузера {menu}.',
  'pwa.manualStepAndroid2': 'Нажмите «Установить приложение» или «Добавить на главный экран».',
  'pwa.manualStepDesktop': 'Откройте меню браузера {menu}.',
  'pwa.manualStepDesktop2': 'Выберите «Установить Master LMS»: в Chrome — в разделе «Трансляция, сохранение и отправка», в Edge — в «Приложениях». Если уже установлено, там будет «Открыть в Master LMS».',
  'pwa.close': 'Закрыть',

  // Settings
  'pwa.entryTitle': 'Установить приложение',
  'pwa.entryDescription': 'Master LMS на главном экране: открывается в одно касание и напоминает об уроках.',
  'pwa.entryUnsupported': 'Этот браузер не устанавливает приложения. Откройте Master LMS в Chrome, Edge или Safari.',
  'pwa.remindersTitle': 'Напоминания об уроках',
  'pwa.remindersDescription': 'Уведомления на этом устройстве перед началом уроков.',
  'pwa.remindersChecking': 'Проверяем устройство…',
  'pwa.remindersNeedsInstall': 'На iPhone напоминания приходят через установленное приложение. Сначала добавьте Master LMS на экран «Домой».',
  'pwa.remindersOff': 'Выключены на этом устройстве.',
  'pwa.remindersOn': 'Включены на этом устройстве.',
  'pwa.turnOff': 'Выключить',
  'pwa.remindersDeniedIos': 'Уведомления запрещены. Откройте Настройки iPhone → Уведомления → Master LMS и разрешите их.',
  'pwa.remindersDeniedAndroid': 'Уведомления запрещены. Удерживайте значок Master LMS → О приложении → Уведомления, или разрешите их в настройках сайта в браузере.',
  'pwa.remindersDeniedDesktop': 'Уведомления запрещены. Нажмите на значок слева от адреса, разрешите уведомления и обновите страницу.',
  'pwa.remindersFailed': 'Не удалось включить напоминания. Проверьте соединение и попробуйте ещё раз.',
};
