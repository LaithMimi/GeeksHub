---
name: feedback-selection-popup
description: "SelectionPopup shared component + portal/document-listener pattern for text selection — location, wiring, and lessons learned"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 52e3d543-adf1-49c9-a2c0-6c5cc9de0097
---

## Shared component

`src/components/ui/selection-popup.tsx` — reusable "Add to notes / Ask AI" popup. Props: `containerRef`, `onPinToNotes`, `onAskAI`. Used in both `AssistantChat` and `FileViewer`.

## Wiring (as of 2026-05-25)

- **AssistantChat**: `containerRef` on the outer div → `onPinToNotes={pinToNotes}`, `onAskAI` fills the textarea.
- **FileViewer**: `containerRef` on the PDF container div → `onPinToNotes` / `onAskAI` passed as props from `FilePage`.
- **FilePage**: holds `assistantRef = useRef<AssistantPanelRef>()` and passes `onPinToNotes={(t) => assistantRef.current?.pinToNotes(t)}` to `FileViewer`.
- **AssistantPanel**: converted to `forwardRef`, exposes `{ pinToNotes }` via `useImperativeHandle`. `AssistantPanelRef` type is a named export.

## Rules

Use `createPortal(…, document.body)` + document-level event listeners registered once (`[]` deps) for any selection popup.

**Why:** Two bugs hit us: `onMouseUp` on Radix `ScrollArea` didn't fire reliably (events don't bubble through the viewport layer), and placing the popup inside `overflow-hidden` flex containers silently hid it.

- Register `mouseup` / `mousedown` on `document` inside `useEffect(() => {…}, [])` — empty deps, registered once.
- Use a `ref` on the popup div + `menuRef.current?.contains(e.target)` to avoid closing when clicking buttons inside it.
- Add `onMouseDown={e.preventDefault()}` on popup buttons so the browser doesn't collapse the selection before `onClick` fires.
- Portal to `document.body` with `z-[9999]` — bypasses all parent stacking contexts and overflow clipping.
- Scope each instance with `containerRef` so two simultaneous instances (chat + file viewer) don't conflict.
