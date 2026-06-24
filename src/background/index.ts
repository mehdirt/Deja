import { savePrompt, hardDelete } from '@/lib/db'
import type { RuntimeMessage } from '@/lib/types'

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message?.type === 'PROMPT_CAPTURED') {
    ;(async () => {
      try {
        const id = await savePrompt({
          text: message.payload.text,
          platform: message.payload.platform,
          url: message.payload.url,
          createdAt: Date.now(),
        })
        sendResponse({ ok: true, id })
      } catch (err) {
        sendResponse({ ok: false, error: String(err) })
      }
    })()
    return true
  }

  if (message?.type === 'UNDO_CAPTURE') {
    ;(async () => {
      try {
        await hardDelete(message.id)
        sendResponse({ ok: true, id: message.id })
      } catch (err) {
        sendResponse({ ok: false, error: String(err) })
      }
    })()
    return true
  }

  return undefined
})
