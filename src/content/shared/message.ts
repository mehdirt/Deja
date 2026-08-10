// Talking to the background worker from inside someone else's page.
//
// Two things make this different from a bare sendMessage. An MV3 worker is
// asleep most of the time, so a call can reject for reasons that aren't errors
// in any useful sense. And after an extension reload the content script is
// orphaned, at which point `chrome.runtime.sendMessage` throws *synchronously*
// — a plain `.catch()` wouldn't even see it.
//
// Both end the same way: the caller gets `undefined` and carries on. Nothing
// here may ever throw into the host page (CLAUDE.md, "Never block the host
// page"), so the failure mode is silence, not an exception.

/** Send a message to the worker. Resolves `undefined` when it couldn't be sent. */
export function sendToWorker<T = unknown>(message: unknown): Promise<T | undefined> {
  if (!chrome.runtime?.id) return Promise.resolve(undefined)
  try {
    return chrome.runtime.sendMessage(message).catch(() => undefined)
  } catch {
    return Promise.resolve(undefined)
  }
}
