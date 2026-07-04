# Seeded Demo Chat And Soft User Bubble Design

## Scope

Update only frontend demo data and message styling in `src/ScientificTangle.Frontend/src/App.tsx` and `src/ScientificTangle.Frontend/src/styles.css`.

## Goal

Show a small pre-filled conversation between the user and AI, and make user messages look less like a hard rectangular block.

## Approach

Add a new local demo chat at the top of recent history and make it the default active chat. Initialize `chatMessagesById` with a short user/assistant exchange for that chat. Keep local chat creation behavior unchanged.

Soften `.message-bubble-user` by replacing the strong filled background with a subtle transparent treatment while preserving right alignment and readable text.

## Acceptance Criteria

The app opens to a selected chat with a short user/AI conversation. The new seeded chat appears at the top of recent history. User message bubbles no longer have a strong square/box-like fill. Creating new local chats and sending messages still works.

## Verification

Run `npm run build` from `src/ScientificTangle.Frontend`.
