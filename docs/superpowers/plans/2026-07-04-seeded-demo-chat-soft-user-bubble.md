# Seeded Demo Chat And Soft User Bubble Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pre-filled demo conversation and soften user message styling.

**Architecture:** Keep the current single-file frontend demo structure. Add one seeded `ChatItem` and initial message map in `App.tsx`, then adjust the user bubble CSS in `styles.css`.

**Tech Stack:** React, TypeScript, Vite, CSS.

## Global Constraints

Frontend-only behavior. Do not call backend chat APIs. Existing local chat creation must keep working. User messages should remain right-aligned but lose the strong rectangular filled look.

---

## File Structure

- Modify: `src/ScientificTangle.Frontend/src/App.tsx` adds seeded chat data and default active chat.
- Modify: `src/ScientificTangle.Frontend/src/styles.css` softens `.message-bubble-user`.

### Task 1: Seed Demo Conversation And Soften User Bubble

**Files:**
- Modify: `src/ScientificTangle.Frontend/src/App.tsx`
- Modify: `src/ScientificTangle.Frontend/src/styles.css`

**Interfaces:**
- Consumes: existing `ChatItem`, `Message`, `initialRecentChats`, `chatMessagesById`, and message bubble classes.
- Produces: `seededDemoChatId`, `initialChatMessagesById`, default active chat set to seeded chat, and softened user bubble CSS.

- [ ] **Step 1: Confirm there is no test runner**

Read `src/ScientificTangle.Frontend/package.json` and confirm scripts include `build` but no `test` script. Use `npm run build` as verification.

- [ ] **Step 2: Add seeded chat id and history item**

In `src/ScientificTangle.Frontend/src/App.tsx`, before `const initialRecentChats`, add:

```ts
const seededDemoChatId = "demo-loss-reduction-dialog";
```

Add this item as the first element of `initialRecentChats`:

```ts
{ id: seededDemoChatId, title: "Диалог по снижению потерь металла" },
```

- [ ] **Step 3: Add seeded messages**

After `initialRecentChats`, add:

```ts
const initialChatMessagesById: Record<string, Message[]> = {
  [seededDemoChatId]: [
    {
      id: "seeded-demo-user-1",
      role: "user",
      text: "Нужно быстро понять, почему выросли потери металла в хвостах за последнюю неделю.",
    },
    {
      id: "seeded-demo-assistant-1",
      role: "assistant",
      text: "Сначала стоит сравнить распределение по сменам, влажность сырья, расход реагентов и долю тонких классов. Эти факторы чаще всего дают резкий рост потерь.",
    },
    {
      id: "seeded-demo-user-2",
      role: "user",
      text: "Какие данные лучше проверить в первую очередь?",
    },
    {
      id: "seeded-demo-assistant-2",
      role: "assistant",
      text: "Начните с трёх срезов: лабораторные пробы хвостов по дням, параметры флотации по сменам и журнал простоев оборудования. Если пики совпадут по времени, можно сузить причину до конкретного участка.",
    },
  ],
};
```

- [ ] **Step 4: Use seeded chat as default active chat**

Change:

```ts
const [activeChatId, setActiveChatId] = useState("r1");
```

to:

```ts
const [activeChatId, setActiveChatId] = useState(seededDemoChatId);
```

Change:

```ts
const [chatMessagesById, setChatMessagesById] = useState<Record<string, Message[]>>({});
```

to:

```ts
const [chatMessagesById, setChatMessagesById] = useState<Record<string, Message[]>>(initialChatMessagesById);
```

- [ ] **Step 5: Soften user bubble styling**

In `src/ScientificTangle.Frontend/src/styles.css`, replace:

```css
.message-bubble-user {
  background: #2f2f2f;
}
```

with:

```css
.message-bubble-user {
  background: rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}
```

- [ ] **Step 6: Run frontend build**

Run: `npm run build`

Working directory: `src/ScientificTangle.Frontend`

Expected: TypeScript and Vite build complete without errors.

- [ ] **Step 7: Review diff**

Run: `git diff -- src/ScientificTangle.Frontend/src/App.tsx src/ScientificTangle.Frontend/src/styles.css docs/superpowers/specs/2026-07-04-seeded-demo-chat-soft-user-bubble-design.md docs/superpowers/plans/2026-07-04-seeded-demo-chat-soft-user-bubble.md`

Expected: diff includes seeded demo chat/messages and softened user bubble CSS.

---

## Self-Review

Spec coverage: Task 1 adds the seeded conversation, makes it default active, keeps local chat creation state, and softens user message styling. Placeholder scan: no placeholders remain. Type consistency: seeded messages use the existing `Message` type and seeded history uses `ChatItem`.
