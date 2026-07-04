# Sidebar Scroll And Chat Open Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make long chat history scroll inside the sidebar and show a compact selected-chat start screen when opening a demo history item.

**Architecture:** Keep the existing React single-file app and CSS structure. Change only the selected-chat render branch in `App.tsx` and the layout rules in `styles.css` so history scroll is contained within the sidebar viewport.

**Tech Stack:** React, TypeScript, Vite, CSS.

## Global Constraints

Do not change backend data, API contracts, authentication logic, or routing. New chat and search screens keep their current behavior. The sidebar history list must scroll independently and the main page must not grow to fit all history items.

---

## File Structure

- Modify: `src/ScientificTangle.Frontend/src/App.tsx` changes the selected chat render branch from static messages to a compact selected-chat start screen.
- Modify: `src/ScientificTangle.Frontend/src/styles.css` constrains sidebar height and adds styles for selected-chat start screen.

### Task 1: Add Contained Sidebar Scroll And Selected Chat Start Screen

**Files:**
- Modify: `src/ScientificTangle.Frontend/src/App.tsx:1150-1161`
- Modify: `src/ScientificTangle.Frontend/src/styles.css:89-96, 433-441`

**Interfaces:**
- Consumes: existing `activeChat.title`, `activeNav`, `isNewChat`, and `isSearchChats` state.
- Produces: existing sidebar buttons still call `handleSelectChat(chat.id)` and selected chats render a compact `.selected-chat-start` section.

- [ ] **Step 1: Confirm there is no test runner**

Read `src/ScientificTangle.Frontend/package.json` and confirm scripts include `build` but no `test` script. Use `npm run build` as verification.

- [ ] **Step 2: Change selected chat rendering**

In `src/ScientificTangle.Frontend/src/App.tsx`, replace the final selected-chat branch inside `.message-list` with:

```tsx
<section className="selected-chat-start" aria-label="Выбранный чат">
  <div className="selected-chat-mark">
    <Icon name="chat" />
  </div>
  <h2>{activeChat.title}</h2>
  <p>Продолжите диалог или задайте уточнение по этой теме.</p>
</section>
```

This replaces the previous `messages.map(...)` rendering only for selected chat histories.

- [ ] **Step 3: Constrain sidebar height**

In `src/ScientificTangle.Frontend/src/styles.css`, update `.sidebar` to use viewport height instead of growing with content:

```css
.sidebar {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: var(--sidebar-width);
  height: 100vh;
  min-height: 0;
  background: var(--bg-sidebar);
  border-right: 0;
  transition:
    width 180ms ease,
    transform 180ms ease,
    opacity 180ms ease;
}
```

- [ ] **Step 4: Add selected-chat start styles**

In `src/ScientificTangle.Frontend/src/styles.css`, add these styles near `.empty-chat` because this is the same main conversation state family:

```css
.selected-chat-start {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 0.9rem;
  width: min(100%, 720px);
  min-height: 100%;
  padding: 3rem 0 1rem;
  text-align: center;
}

.selected-chat-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 1px solid var(--border-soft);
  border-radius: 999px;
  color: var(--text-main);
}

.selected-chat-start h2 {
  max-width: min(100%, 680px);
  margin: 0;
  font-size: clamp(1.45rem, 3vw, 1.9rem);
  font-weight: 600;
  letter-spacing: -0.03em;
}

.selected-chat-start p {
  max-width: 520px;
  margin: 0;
  color: var(--text-muted);
}
```

- [ ] **Step 5: Run frontend build**

Run: `npm run build`

Working directory: `src/ScientificTangle.Frontend`

Expected: TypeScript and Vite build complete without errors.

- [ ] **Step 6: Review diff**

Run: `git diff -- src/ScientificTangle.Frontend/src/App.tsx src/ScientificTangle.Frontend/src/styles.css docs/superpowers/specs/2026-07-04-sidebar-scroll-chat-open-design.md docs/superpowers/plans/2026-07-04-sidebar-scroll-chat-open.md`

Expected: diff includes only the selected-chat branch, sidebar height CSS, selected-chat styles, and the new spec/plan docs.

---

## Self-Review

Spec coverage: Task 1 constrains sidebar height, keeps `.sidebar-scroll` as the scrollable area, and changes selected demo chats to a compact start screen. New chat and search branches are not modified. Placeholder scan: no placeholders remain. Type consistency: the JSX uses existing `activeChat.title` and existing `Icon` names.
