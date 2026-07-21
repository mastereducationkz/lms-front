# Group Chat — Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add group-chat UI to the LMS web app (`lms/frontend`) — a "Groups" section in the existing `/chat` list and a group conversation pane — reusing the existing 1:1 chat socket + attachment renderer. Targets the backend contract in mastereducationkz/lms-backend#42. The 1:1 chat is untouched.

**Architecture:** The web chat is a single `/chat` page (`src/pages/ChatPage.tsx`) with local `useState` and one shared socket singleton (`connectSocket()`); there is no store. Add parallel group state (`groupThreads`, `activeGroupConvId`) alongside the existing DM state (`activePartnerId`), mutually exclusive (opening a group clears the active partner and vice versa). Add `group:*` socket listeners on the same socket. A new group message pane renders sender names and decides ownership by the current user id (the DM pane's `from_user_id === activePartnerId` trick does not generalize to groups).

**Tech Stack:** React + TypeScript + Vite, socket.io-client, axios (`src/services/api/client.ts`), react-router. No web unit-test harness — verification is `npx tsc --noEmit` (or the project's typecheck script) + manual smoke.

## Global Constraints

- Backend contract (already shipped, target exactly):
  - REST: `GET /messages/groups` → `GroupThread[]`; `GET /messages/groups/{conversation_id}` → `GroupMessage[]` (oldest→newest); `POST /messages/groups/{conversation_id}` body `{ content, file_url }` → `GroupMessage`.
  - Socket client→server: `group:message:send { conversation_id, content, file_url }`, `group:read { conversation_id }`. Server→client: `group:message:new` (a `GroupMessage`), `group:threads:update`, `group:unread:update`, `message:error`.
  - `GroupMessage`: `{ id, conversation_id, from_user_id, sender_name, content, file_url, created_at }` — **NO `is_read`**. `GroupThread`: `{ id, group_id, kind, title, last_message: GroupMessage|null, unread_count }`.
- **Ownership in group view:** a message is "mine" iff `message.from_user_id === Number(currentUser.id)` (note `User.id` is a STRING, `from_user_id` is a NUMBER — coerce). Do NOT reuse the DM `from_user_id === activePartnerId` check for groups.
- **Render `sender_name`** above/near each incoming (not-mine) group bubble. Do NOT render the DM read-receipt check-marks for group bubbles (`GroupMessage` has no `is_read`).
- **Attachments (v1): text-only send.** The existing web 1:1 chat has no upload picker; do not add one here. Still render `message.file_url` via the existing `ChatAttachment` component if a group message carries one. (Upload picker is a documented follow-up.)
- Group unread is thread-level (`GroupThread.unread_count`); mark a group thread read on open via `group:read`.
- No group-creation UI — channels are server-provisioned; the list only shows existing group threads.
- Do NOT modify the DM flow (`activePartnerId`, `message:*` listeners, `sendMessage`, DM bubble rendering). Add parallel group logic.
- New API functions are named exports in `src/services/api/chat.ts`; the barrel `src/services/api/index.ts` re-exports via `export * from './chat'` automatically. Import them in `ChatPage.tsx` from `"../services/api"`.
- Branch: `feature/group-chat-web` off `master` (create before Task 1). Commit messages: no `Co-Authored-By`. Never `git add -A`. NOTE: `master` auto-deploys to prod via Vercel — do NOT push to `master`; push the feature branch and open a PR.

## File Structure

- `src/types/index.ts` — MODIFY: add `GroupMessage`, `GroupThread` (near `Message`/`MessageThread`, ~line 926).
- `src/services/api/chat.ts` — MODIFY: add `fetchGroupThreads`, `fetchGroupMessages`, `sendGroupMessage`.
- `src/pages/ChatPage.tsx` — MODIFY: group state, Groups list section, open-group handler, group message pane, group send, `group:*` socket listeners.

---

### Task 1: Types + group chat API functions

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/services/api/chat.ts`

**Interfaces:**
- Produces: `GroupMessage`, `GroupThread` types; `fetchGroupThreads()`, `fetchGroupMessages(conversationId)`, `sendGroupMessage(conversationId, content, fileUrl?)`.

- [ ] **Step 1: Add the types**

In `src/types/index.ts`, next to `Message`/`MessageThread` (~line 926):
```typescript
export interface GroupMessage {
  id: number;
  conversation_id: number;
  from_user_id: number;
  sender_name: string;
  content: string;
  file_url?: string;
  created_at: string;
}

export interface GroupThread {
  id: number;
  group_id: number;
  kind: string; // 'class' | 'parents'
  title: string;
  last_message: GroupMessage | null;
  unread_count: number;
}
```

- [ ] **Step 2: Add the API functions**

In `src/services/api/chat.ts`, add (mirroring the existing degrade-gracefully style; `import { api } from './client'` is already at the top):
```typescript
export async function fetchGroupThreads() {
  try {
    const response = await api.get('/messages/groups');
    return response.data;
  } catch (error) {
    console.warn('Failed to load group threads:', error);
    return [];
  }
}

export async function fetchGroupMessages(conversationId: number | string): Promise<any[]> {
  try {
    const response = await api.get(`/messages/groups/${conversationId}`);
    return response.data;
  } catch (error) {
    console.warn('Failed to load group messages:', error);
    return [];
  }
}

export async function sendGroupMessage(conversationId: number | string, content: string, fileUrl?: string): Promise<any> {
  const response = await api.post(`/messages/groups/${conversationId}`, { content, file_url: fileUrl });
  return response.data;
}
```
(These are picked up by the barrel `export * from './chat'` in `src/services/api/index.ts` automatically — verify that line exists; if the app also spreads chat fns onto an `apiClient` object, no change needed since `ChatPage` imports named exports from `"../services/api"`.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit` (or the repo's typecheck: check `package.json` scripts for `typecheck`/`build`).
Expected: no NEW errors in `types/index.ts` or `services/api/chat.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/services/api/chat.ts
git commit -m "feat(chat): group chat types and web api functions"
```

---

### Task 2: ChatPage group integration

**Files:**
- Modify: `src/pages/ChatPage.tsx`

**Interfaces:**
- Consumes: Task 1's `fetchGroupThreads`/`fetchGroupMessages`/`sendGroupMessage` + types; the existing `connectSocket()`, `ChatAttachment`, `currentUser`, `loadThreads`.

- [ ] **Step 1: Add group state + load group threads**

Import the new functions/types from `"../services/api"` and `"../types"`. Add state next to the existing chat state (~lines 37-47):
```tsx
const [groupThreads, setGroupThreads] = useState<GroupThread[]>([]);
const [activeGroupConvId, setActiveGroupConvId] = useState<number | null>(null);
```
Add a loader (mirroring `loadThreads`) and call it wherever `loadThreads()` is called (initial load, `threads:update`, the visible-poll):
```tsx
const loadGroupThreads = async () => {
  const data = await fetchGroupThreads();
  setGroupThreads(data);
};
```
In the initial-load effect and `useVisiblePolling` callback, also `void loadGroupThreads();`.

- [ ] **Step 2: Mutual-exclusion open handlers**

When opening a DM (existing `startNewChat` and any thread-row click that calls `setActivePartnerId`), also `setActiveGroupConvId(null)`.
Add a group open handler:
```tsx
const openGroup = async (conv: GroupThread) => {
  setActivePartnerId(null);
  setActiveGroupConvId(conv.id);
  setShowNewChatDialog(false);
  const msgs: any[] = await fetchGroupMessages(conv.id);
  setMessages(msgs); // group endpoint already returns oldest→newest; do NOT reverse
  const socket = connectSocket();
  if (socket && socket.connected) socket.emit('group:read', { conversation_id: conv.id });
  setGroupThreads(prev => prev.map(t => t.id === conv.id ? { ...t, unread_count: 0 } : t));
  void loadThreads();
};
```
(Reuse the shared `messages` state; the message pane branches on `activeGroupConvId`.)

- [ ] **Step 3: Render a "Groups" section in the thread list**

In the left list column, above (or below) the existing `threads.map(...)` block, add a Groups section rendered from `groupThreads` (reuse the existing row classes; key by `t.id`; show `t.title`, `t.last_message?.content`, `t.unread_count`; onClick → `openGroup(t)`; highlight when `activeGroupConvId === t.id`). Use a small section heading ("Группы"/"Groups") consistent with the app's `curator`/`head_curator` Russian labels already used in the sidebar.

- [ ] **Step 4: Group message pane rendering**

Where the message pane renders `messages.map(...)`, branch on `activeGroupConvId`. When a group is active, render each message with:
- ownership `const isMine = message.from_user_id === Number(currentUser?.id);` (coerce the string id),
- for `!isMine`, a `sender_name` label above the bubble,
- reuse `<ChatAttachment fileUrl={message.file_url} />` when `message.file_url`,
- NO read-receipt check-marks (group messages have no `is_read`).
Keep the existing DM rendering unchanged for when `activePartnerId` is set. The header should show the group `title` (from the active `groupThreads` row) instead of a partner name.

- [ ] **Step 5: Group send handler**

In `handleSendMessage` (or a group-aware branch of it), when `activeGroupConvId` is set:
```tsx
const socket = connectSocket();
if (socket && socket.connected) {
  socket.emit('group:message:send', { conversation_id: activeGroupConvId, content: optimistic });
} else {
  await sendGroupMessage(activeGroupConvId, optimistic);
}
void loadGroupThreads();
```
Guard the early-return so it allows sending when either `activePartnerId` OR `activeGroupConvId` is set.

- [ ] **Step 6: Group socket listeners**

In the socket effect (currently `[activePartnerId]` deps — extend deps to include `activeGroupConvId`), add and clean up:
```tsx
const onGroupMessageNew = (payload: any) => {
  if (payload.conversation_id === activeGroupConvId) {
    setMessages(prev => prev.some(m => m.id === payload.id) ? prev : [...prev, payload]);
  }
  void loadGroupThreads();
};
const onGroupThreadsUpdate = () => { void loadGroupThreads(); };
const onGroupUnreadUpdate = () => { void loadGroupThreads(); };
socket.on('group:message:new', onGroupMessageNew);
socket.on('group:threads:update', onGroupThreadsUpdate);
socket.on('group:unread:update', onGroupUnreadUpdate);
// …and socket.off(...) for all three in the cleanup.
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no NEW errors in `ChatPage.tsx`.

- [ ] **Step 8: Commit**

```bash
git add src/pages/ChatPage.tsx
git commit -m "feat(chat): group conversations in the web chat page"
```

---

## Self-Review

**Spec coverage** (design spec §2.8 Web):
- Group threads in the conversation list → Task 2 (Groups section). ✅
- Group conversation view with per-sender messages → Task 2 (Step 4). ✅
- Same `group:*` socket events → Task 2 (Step 6). ✅
- Reuse attachment rendering → Task 2 (ChatAttachment). ✅ (upload picker deferred — matches web 1:1 which has none.)
- Types + API → Task 1. ✅

**Resolved ambiguities:** ownership via `Number(currentUser.id)` (string→number), no `is_read`/read-receipts for groups, group messages oldest→newest (no reverse), text-only send in v1, no group-creation UI.

**Type consistency:** `GroupMessage`/`GroupThread` match the backend dicts; `fetchGroupThreads`/`fetchGroupMessages`/`sendGroupMessage` referenced identically in Task 1 and Task 2.

## Verification (end-to-end)

- `npx tsc --noEmit` clean on the touched files.
- Manual smoke (needs lms-backend#42 deployed): as a curator/student in a provisioned group, `/chat` shows a "Groups" section → open the class channel → messages load oldest→newest with sender names → send a text message → it appears; a second member sees it live via `group:message:new`; the DM flow still works unchanged; a group message with a `file_url` renders via ChatAttachment.
