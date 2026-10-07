import type { MessageTable } from '../types';

/**
 * Installing the app and lesson reminders (components/pwa): the dashboard card, the install sheet,
 * the Settings entries. `{share}`, `{more}`, `{add}` and `{menu}` in a step are drawn as the icon
 * the person has to look for (InstallSheet.tsx), so they stay as they are.
 */
export const pwa = {
  'pwa.appName': 'Master LMS',

  // Dashboard card
  'pwa.cardTitlePhone': 'Get Master LMS on your phone',
  'pwa.cardTitleComputer': 'Install Master LMS on this computer',
  'pwa.cardTitleInApp': 'Get Master LMS as an app',
  'pwa.cardBody': 'A reminder before every lesson, and your homework one tap away.',
  'pwa.cardBodyComputer': 'Open it from your dock or taskbar, with a reminder before every lesson.',
  'pwa.cardBodyInApp': 'Open this page in your browser to install it: a reminder before every lesson, and your homework one tap away.',
  'pwa.teacherLine': 'Install Master LMS for one-tap access and lesson reminders.',
  'pwa.install': 'Install',
  'pwa.installApp': 'Install the app',
  'pwa.showMeHow': 'Show me how',
  'pwa.notNow': 'Not now',

  // Reminders card (inside the installed app)
  'pwa.pushTitle': 'Turn on lesson reminders',
  'pwa.pushBody': 'We’ll let you know before each lesson starts, so you’re never late.',
  'pwa.turnOn': 'Turn on',
  'pwa.pushOnToast': 'Lesson reminders are on',
  'pwa.pushBlockedToast': 'Notifications are blocked. You can allow them in Settings.',

  // Sheet: iPhone/iPad
  'pwa.iosTitle': 'Add Master LMS to your Home Screen',
  'pwa.iosLead': 'It opens like an app, and it can remind you before your lessons.',
  'pwa.iosStepShareMore': 'Tap {more} at the bottom of Safari, then {share}.',
  'pwa.iosStepShare': 'Tap {share} in Safari’s toolbar.',
  'pwa.iosStepShareTop': 'Tap {share} at the top of the screen.',
  'pwa.iosStepShareChrome': 'Tap {share} in the address bar.',
  'pwa.iosStepAdd': 'Scroll down and tap {add}.',
  'pwa.iosStepConfirm': 'Tap Add in the top corner.',
  'pwa.iosStepConfirmWebApp': 'Leave “Open as Web App” on and tap Add.',
  'pwa.more': 'More',
  'pwa.share': 'Share',
  'pwa.addToHomeScreen': 'Add to Home Screen',
  'pwa.copy': 'Copy',
  'pwa.addBookmark': 'Add Bookmark',
  'pwa.toolbarHint': 'Safari’s toolbar is just below',
  'pwa.gotIt': 'Got it',
  'pwa.alreadyAdded': 'It’s on my Home Screen',

  // Sheet: in-app browser ({browser} is Safari or Chrome, {app} the app's name)
  'pwa.inAppTitle': 'Open Master LMS in {browser}',
  'pwa.inAppLeadNamed': '{app}’s built-in browser can’t install apps. Open this page in {browser}, then add it to your Home Screen.',
  'pwa.inAppLead': 'This built-in browser can’t install apps. Open this page in {browser}, then add it to your Home Screen.',
  'pwa.inAppStepOpen': 'Choose “Open in {browser}” (or “Open in browser”).',
  'pwa.inAppStepMenu': 'Tap {more} in the corner of the screen.',
  'pwa.inAppOr': 'Or copy the link and paste it into the address bar:',
  'pwa.copyLink': 'Copy link',
  'pwa.copied': 'Copied',
  'pwa.menu': 'Menu',

  // Sheet: Android / computer without the one-tap prompt
  'pwa.manualTitle': 'Install Master LMS',
  'pwa.manualLeadAndroid': 'Your browser can add Master LMS to your home screen as an app.',
  'pwa.manualLeadDesktop': 'Chrome and Edge can install Master LMS as an app on this computer.',
  'pwa.manualStepAndroid': 'Open the browser menu {menu}.',
  'pwa.manualStepAndroid2': 'Tap “Install app” or “Add to Home screen”.',
  'pwa.manualStepDesktop': 'Open the browser menu {menu}.',
  'pwa.manualStepDesktop2': 'Choose “Install Master LMS”: in Chrome it’s under “Cast, save and share”, in Edge under “Apps”. Already installed? You’ll see “Open in Master LMS” instead.',
  'pwa.close': 'Close',

  // Settings
  'pwa.entryTitle': 'Install the app',
  'pwa.entryDescription': 'Master LMS on your home screen: opens in one tap, with lesson reminders.',
  'pwa.entryUnsupported': 'This browser can’t install apps. Open Master LMS in Chrome, Edge or Safari to install it.',
  'pwa.remindersTitle': 'Lesson reminders',
  'pwa.remindersDescription': 'Notifications on this device before your lessons start.',
  'pwa.remindersChecking': 'Checking this device…',
  'pwa.remindersNeedsInstall': 'On iPhone, reminders come through the installed app. Add Master LMS to your Home Screen first.',
  'pwa.remindersOff': 'Off on this device.',
  'pwa.remindersOn': 'On for this device.',
  'pwa.turnOff': 'Turn off',
  'pwa.remindersDeniedIos': 'Notifications are blocked. Open iPhone Settings → Notifications → Master LMS and allow them.',
  'pwa.remindersDeniedAndroid': 'Notifications are blocked. Long-press the Master LMS icon → App info → Notifications, or allow them in your browser’s site settings.',
  'pwa.remindersDeniedDesktop': 'Notifications are blocked. Click the icon left of the address bar, allow Notifications, then reload.',
  'pwa.remindersFailed': 'Couldn’t turn on reminders. Check your connection and try again.',
} as const satisfies MessageTable;
