# Frontend Demo Chat Create Design

## Scope

Update only the frontend demo chat behavior in `src/ScientificTangle.Frontend/src/App.tsx`.

## Goal

When a user submits text from the composer, create or continue a local demo chat, show the user message and a mock assistant answer, and add new chats to the visible history.

## Approach

Keep this frontend-only. Do not call `POST /api/chats` yet. Convert the recent chat list into React state initialized from the current demo data. Store per-chat local messages in a `Record<string, Message[]>`.

Submitting from `New chat` creates a local chat id, derives the title from the first message, prepends the chat to recent history, activates it, and writes user/assistant messages. Submitting from an existing selected chat appends user/assistant messages to that chat. Enter submits; Shift+Enter inserts a newline.

## Acceptance Criteria

Clicking the send button with non-empty text creates a new local chat from the new-chat screen. Pressing Enter with non-empty text does the same. The new chat appears at the top of recent history and becomes active. Existing selected chats can receive additional local messages. Empty submissions are ignored. New chat and search navigation remain available.

## Verification

Run `npm run build` from `src/ScientificTangle.Frontend`.
