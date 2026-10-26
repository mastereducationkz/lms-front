import type { MessageTable } from '../types';

/** Seasonal decorations (owner, 2026-10-26): the Halloween week across the LMS. Warm, never scary. */
export const seasonal = {
  'seasonal.toggle.label': 'Halloween decorations',
  'seasonal.toggle.hint': 'Pumpkins, bats and costumes until 31 October. This setting is for this device only.',

  'seasonal.halloween.greeting.title': 'Happy Halloween, {name}!',
  'seasonal.halloween.greeting.titleNoName': 'Happy Halloween!',
  'seasonal.halloween.greeting.body': 'Five pumpkins are hiding around the LMS until 31 October. Find all five for a surprise.',
  'seasonal.halloween.greeting.done': 'All five pumpkins found. Kasatik is proud of you.',
  'seasonal.halloween.greeting.progress': { one: '{count} of 5 found', other: '{count} of 5 found' },
  'seasonal.halloween.greeting.close': 'Close the greeting',
  'seasonal.halloween.greeting.turnOff': 'Turn off decorations',
  'seasonal.halloween.greeting.card': 'Get your card',

  'seasonal.halloween.pumpkin.label': 'Trick or treat',
  'seasonal.halloween.treat.title': 'Treat!',
  'seasonal.halloween.treat.1': 'Your brain just earned a chocolate bar. Spend it on one more practice question.',
  'seasonal.halloween.treat.2': 'Boo! Only joking. You are doing great this week.',
  'seasonal.halloween.treat.3': 'The scariest word in a test question is "except". Read it twice.',
  'seasonal.halloween.treat.4': 'Homework done early tastes better than candy.',
  'seasonal.halloween.treat.5': 'A ghost\'s favourite subject is boo-logy. Yours can be anything you practise.',
  'seasonal.halloween.treat.6': 'Five pumpkins are hiding around the LMS. One might be on the next page you open.',
  'seasonal.halloween.treat.7': 'Wrong answers are not monsters. They show you exactly what to practise next.',
  'seasonal.halloween.treat.8': 'Kasatik says: a short break, then one more page. You have got this.',
  'seasonal.halloween.treat.dismiss': 'Close',

  'seasonal.halloween.hunt.pumpkin': 'A hidden pumpkin. Pick it up',
  'seasonal.halloween.hunt.found': 'Pumpkin {count} of 5!',
  'seasonal.halloween.hunt.keepLooking': 'Keep looking: the rest are on other pages.',

  'seasonal.halloween.finale.title': 'All five pumpkins found!',
  'seasonal.halloween.finale.body': 'Kasatik flew a lap of honour round the LMS for you. Here is a card to keep or share.',
  'seasonal.halloween.finale.close': 'Close',
  'seasonal.halloween.card.title': '5 of 5 pumpkins',
  'seasonal.halloween.card.line': 'found on Master LMS this Halloween',
  'seasonal.halloween.card.pill': 'Halloween 2026',
  'seasonal.halloween.card.alt': 'Your Halloween card: five of five pumpkins found',
  'seasonal.halloween.card.drawing': 'Drawing your card…',
  'seasonal.halloween.card.failed': 'The card could not be drawn on this device.',
} as const satisfies MessageTable;
