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

  // Admin → Recordings rollout: why a pending teacher can't be imported or connected yet (lib/workspaceRollout).
  'workspace.rollout.addressEmpty': 'Enter the Workspace address',
  'workspace.rollout.addressDomain': 'Must end with @{domain}',
  'workspace.rollout.addressInvalid': 'Not a valid mailbox name',
  'workspace.rollout.firstNameEmpty': 'First name is empty',
  'workspace.rollout.lastNameEmpty': 'Last name is empty',
  'workspace.rollout.firstNameTooLong': 'First name is longer than {max} characters',
  'workspace.rollout.lastNameTooLong': 'Last name is longer than {max} characters',
  'workspace.rollout.firstNameLatin': 'First name must be written in English letters',
  'workspace.rollout.lastNameLatin': 'Last name must be written in English letters',
  'workspace.rollout.alreadyConnected': 'Already connected to {name}',
  'workspace.rollout.uploadListFirst': 'Upload the Workspace users list first',
  'workspace.rollout.suspended': 'This account is suspended in Google Workspace',
} as const satisfies MessageTable;
