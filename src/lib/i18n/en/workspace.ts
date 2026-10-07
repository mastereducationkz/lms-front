import type { MessageTable } from '../types';

/** Admin → Recordings rollout: the instructions an admin copies and sends a teacher. */
export const workspace = {
  'workspace.instructions.greeting': 'Hello!',
  'workspace.instructions.greetingNamed': 'Hello, {name}!',
  'workspace.instructions.intro': 'A Master Education work Google account has been created for your lessons:',
  'workspace.instructions.address': 'Address: {email}',
  'workspace.instructions.password': 'Temporary password: ________',
  'workspace.instructions.signIn': '1. Before your next lesson, open https://accounts.google.com, sign in as {email} and set your own password. Until you have signed in once, Google doesn’t treat you as school staff — and the lesson won’t be recorded.',
  'workspace.instructions.join': '2. Join lessons with the “Join” button in the LMS: the link opens Meet under your work account. If Google asks which account to use, choose {email}, not your personal one.',
  'workspace.instructions.recording': '3. Recording starts on its own — there’s nothing to press. Recordings of your lessons appear in the LMS under Lesson Recordings.',
} as const satisfies MessageTable;
