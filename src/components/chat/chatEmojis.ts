// Emoji sets for the chat reaction picker. Kept as plain data (no external
// emoji-picker dependency) so the bundle stays lean and the picker matches the
// mobile client's set exactly.

// The one-tap quick-reaction row shown above the full grid (WhatsApp-style).
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Fuller grid for "any emoji", grouped so the picker can show light section labels.
export const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: [
      '😀', '😁', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰',
      '😘', '😜', '🤪', '🤗', '🤔', '🤨', '😐', '😴', '😎', '🥳',
      '😭', '😢', '😤', '😠', '😱', '😳', '🥺', '😬', '🙄', '😏',
    ],
  },
  {
    label: 'Gestures',
    emojis: [
      '👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '👌', '✌️', '🤞',
      '👋', '🤙', '👊', '✊', '🫶', '🤟', '☝️', '👆', '👇', '🫡',
    ],
  },
  {
    label: 'Hearts & symbols',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '🔥',
      '✨', '⭐', '🎉', '🎊', '✅', '❌', '❓', '❗', '💤', '👀',
    ],
  },
  {
    label: 'Objects',
    emojis: [
      '📚', '✏️', '📝', '📌', '📎', '💡', '🏆', '🎯', '⏰', '📅',
      '☕', '🍕', '🎁', '🚀', '💰', '📈', '🙈', '🤯', '🥇', '💬',
    ],
  },
];
