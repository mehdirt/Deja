// Shared "what is the user actually typing in" resolution for capture.ts and
// resurface.ts. Both need to read the live composer text and find the real
// editable target from a DOM event; keeping one copy means a selector or
// Shadow-DOM fix only has to happen once.

import { isCapturableField } from '@/lib/sensitive'

// Read only what we're allowed to read. Never touches an <input> (so a
// password field's value is unreachable) — only ever reads the
// textarea/contenteditable composer. Inputs are gated out upstream by
// isCapturableField, but this is also a backstop against reading .value here.
export function readText(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement) return el.value
  return el.innerText
}

// Find the capturable editable the user is actually typing in, resolved from
// the event path. composedPath() pierces Shadow DOM and gives the real target
// even when the event is retargeted — trusting the page selector alone is
// fragile, because a site's composer node can differ from what the selector
// resolves to (or drift over time). isCapturableField excludes <input>
// entirely (so password/email/search fields can never match) and refuses
// credential/OTP/payment fields.
export function editableFromEvent(e: Event): HTMLElement | null {
  const path = (e.composedPath?.() ?? []) as Element[]
  for (const node of path) {
    if (isCapturableField(node)) return node
  }
  const target = e.target as Element | null
  // Note: no bare "input" in this selector — inputs are never the composer.
  const closest = target?.closest?.('textarea, [contenteditable="true"]') ?? null
  return isCapturableField(closest) ? closest : null
}
