/**
 * Which of the chat page's two cards a screen shows.
 *
 * From lg up both sit side by side. Below lg they used to stack, so an open conversation got the
 * height the thread list left over (two bubbles on a phone). Now a phone shows the list until a
 * chat is opened, then only the conversation, with a back button (`back`) to the list.
 */
export function chatPaneClasses(hasOpenChat: boolean): { list: string; conversation: string; back: string } {
  return {
    list: hasOpenChat ? 'hidden lg:flex' : 'flex',
    conversation: hasOpenChat ? 'flex' : 'hidden lg:flex',
    back: hasOpenChat ? 'lg:hidden' : 'hidden',
  };
}
