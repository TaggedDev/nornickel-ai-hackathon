# Sidebar Scroll And Chat Open Design

## Scope

Update the frontend chat shell only: `src/ScientificTangle.Frontend/src/App.tsx` and `src/ScientificTangle.Frontend/src/styles.css`.

## Goal

Make the long chat history scroll inside the sidebar and make selecting a demo chat open a compact ChatGPT-like chat start screen instead of expanding the page to fit all history.

## Approach

Keep the current sidebar structure. Set the sidebar to viewport height so the existing `.sidebar-scroll` region becomes the only scrollable history area between the fixed top navigation and fixed profile footer.

For selected demo chats, render a compact selected-chat start screen in the conversation area. The screen shows the selected chat title, a short helper line, and keeps the composer at the bottom. Do not render the old static `messages` list for selected demo histories.

## Acceptance Criteria

The sidebar remains viewport-height and does not grow with all chat history items. The history list scrolls independently. Clicking a pinned or recent chat changes the active title and shows a centered selected-chat screen. New chat and search screens keep their current behavior.

## Verification

Run the frontend build with `npm run build` from `src/ScientificTangle.Frontend`.
