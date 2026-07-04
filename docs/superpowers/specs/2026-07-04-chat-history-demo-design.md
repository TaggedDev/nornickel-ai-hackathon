# Demo Chat History Design

## Scope

Update only the frontend demo chat history in `src/ScientificTangle.Frontend/src/App.tsx`.

## Goal

Replace the existing small hardcoded chat history with a richer set of 30+ visible chat titles so the sidebar feels populated like ChatGPT.

## Approach

Keep the existing sidebar layout, routing, state, and backend API behavior unchanged. Replace the `pinnedChats` and `recentChats` arrays with new Russian-language demo chat titles relevant to Nornickel, metallurgy, production analytics, knowledge graphs, reports, and LLM workflows.

## Data Shape

Use the existing `ChatItem` type:

```ts
type ChatItem = {
  id: string;
  title: string;
};
```

## Acceptance Criteria

The sidebar displays several pinned chats and at least 30 recent chats. No database data, API contracts, authentication logic, or layout behavior changes are included.

## Verification

Run the frontend build to confirm the TypeScript/Vite application still compiles.
