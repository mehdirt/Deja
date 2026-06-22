import { savePrompt } from '@/lib/db'
import type { CapturedPromptMessage } from '@/lib/types'

chrome.runtime.onMessage.addListener((message: CapturedPromptMessage, _sender, sendResponse) => {
  if (message?.type !== 'PROMPT_CAPTURED') return
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
})
