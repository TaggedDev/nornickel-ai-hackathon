# Frontend Demo Chat Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and continue local demo chats from the composer, including adding new chats to sidebar history and showing user/mock assistant messages.

**Architecture:** Keep behavior in `App.tsx` because the current app is a single-file demo shell. Convert recent demo chats into state, add per-chat message state, and route composer submit/Enter through one handler.

**Tech Stack:** React, TypeScript, Vite.

## Global Constraints

Frontend-only behavior. Do not call backend chat APIs. Empty submissions are ignored. Enter submits and Shift+Enter creates a newline. New local chats are prepended to recent history and become active.

---

## File Structure

- Modify: `src/ScientificTangle.Frontend/src/App.tsx` adds local chat state, submit handling, and message rendering.
- No CSS changes are required unless existing message styles are reused.

### Task 1: Add Local Demo Chat Creation And Continuation

**Files:**
- Modify: `src/ScientificTangle.Frontend/src/App.tsx`

**Interfaces:**
- Consumes: existing `ChatItem`, `Message`, `recentChats`, `draft`, `activeNav`, `activeChatId`, `handleSelectChat`.
- Produces: `recentChatItems: ChatItem[]`, `chatMessagesById: Record<string, Message[]>`, `handleSubmitMessage()`, `handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>)`.

- [ ] **Step 1: Confirm there is no test runner**

Read `src/ScientificTangle.Frontend/package.json` and confirm scripts include `build` but no `test` script. Use `npm run build` as verification.

- [ ] **Step 2: Rename static recent chat seed**

Change:

```ts
const recentChats: ChatItem[] = [
```

to:

```ts
const initialRecentChats: ChatItem[] = [
```

- [ ] **Step 3: Add local chat state**

Inside `App`, after `const [activeChatId, setActiveChatId] = useState("r1");`, add:

```ts
const [recentChatItems, setRecentChatItems] = useState<ChatItem[]>(initialRecentChats);
const [chatMessagesById, setChatMessagesById] = useState<Record<string, Message[]>>({});
```

- [ ] **Step 4: Add local helper functions**

Inside `App`, before `handleAuthSuccess`, add:

```ts
function createLocalChatTitle(messageText: string) {
  const normalized = messageText.replace(/\s+/g, " ").trim();
  return normalized.length > 54 ? `${normalized.slice(0, 54)}...` : normalized;
}

function createMockAssistantAnswer(messageText: string) {
  return `Принял запрос: «${messageText}». Для демо я подготовлю краткий ответ и могу продолжить анализ по этой теме.`;
}
```

- [ ] **Step 5: Add submit handler**

Inside `App`, after `handleSelectChat`, add:

```ts
function handleSubmitMessage() {
  const messageText = draft.trim();
  if (!messageText) {
    return;
  }

  const now = Date.now();
  const targetChatId = activeNav === "chat" ? activeChatId : `local-${now}`;
  const userMessage: Message = {
    id: `${targetChatId}-user-${now}`,
    role: "user",
    text: messageText,
  };
  const assistantMessage: Message = {
    id: `${targetChatId}-assistant-${now}`,
    role: "assistant",
    text: createMockAssistantAnswer(messageText),
  };

  if (activeNav !== "chat") {
    const newChat: ChatItem = {
      id: targetChatId,
      title: createLocalChatTitle(messageText),
    };
    setRecentChatItems((items) => [newChat, ...items]);
  }

  setChatMessagesById((messagesById) => ({
    ...messagesById,
    [targetChatId]: [...(messagesById[targetChatId] ?? []), userMessage, assistantMessage],
  }));
  setActiveChatId(targetChatId);
  setActiveNav("chat");
  setDraft("");
}
```

- [ ] **Step 6: Add Enter key handler**

Inside `App`, after `handleSubmitMessage`, add:

```ts
function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }

  event.preventDefault();
  handleSubmitMessage();
}
```

- [ ] **Step 7: Replace recent chat references**

Change `const allChats = [...pinnedChats, ...recentChats];` to:

```ts
const allChats = [...pinnedChats, ...recentChatItems];
```

Change fallback `?? recentChats[0]` to:

```ts
?? recentChatItems[0]
```

Change `{recentChats.map((chat) => {` to:

```tsx
{recentChatItems.map((chat) => {
```

- [ ] **Step 8: Render local messages for active chats**

After `const canSend = draft.trim().length > 0;`, add:

```ts
const activeMessages = activeNav === "chat" ? (chatMessagesById[activeChatId] ?? []) : [];
```

Replace the selected-chat render branch with:

```tsx
activeMessages.length > 0 ? (
  activeMessages.map((message) => (
    <article
      key={message.id}
      className={`message-row ${message.role === "user" ? "message-row-user" : "message-row-assistant"}`}
    >
      <div className={`message-bubble message-bubble-${message.role}`}>
        <p>{message.text}</p>
      </div>
    </article>
  ))
) : (
  <section className="selected-chat-start" aria-label="Выбранный чат">
    <div className="selected-chat-mark">
      <Icon name="chat" />
    </div>
    <h2>{activeChat.title}</h2>
    <p>Продолжите диалог или задайте уточнение по этой теме.</p>
  </section>
)
```

- [ ] **Step 9: Wire composer submit and Enter**

Change composer form:

```tsx
<form className="composer" onSubmit={(event) => event.preventDefault()}>
```

to:

```tsx
<form
  className="composer"
  onSubmit={(event) => {
    event.preventDefault();
    handleSubmitMessage();
  }}
>
```

Add `onKeyDown={handleComposerKeyDown}` to the textarea.

- [ ] **Step 10: Run frontend build**

Run: `npm run build`

Working directory: `src/ScientificTangle.Frontend`

Expected: TypeScript and Vite build complete without errors.

- [ ] **Step 11: Review diff**

Run: `git diff -- src/ScientificTangle.Frontend/src/App.tsx docs/superpowers/specs/2026-07-04-frontend-demo-chat-create-design.md docs/superpowers/plans/2026-07-04-frontend-demo-chat-create.md`

Expected: diff includes local chat creation state/handlers/rendering and the new spec/plan docs.

---

## Self-Review

Spec coverage: Task 1 handles button submit, Enter submit, Shift+Enter newline, new chat creation, active chat continuation, history insertion, and empty submission ignore. Placeholder scan: no placeholders remain. Type consistency: all state uses existing `ChatItem` and `Message` types.
