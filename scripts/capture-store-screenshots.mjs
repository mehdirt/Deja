#!/usr/bin/env node
/**
 * Capture Chrome Web Store screenshots (1280×800) from a real loaded
 * extension. Usage: node scripts/capture-store-screenshots.mjs
 *
 * Launches Chrome with dist/ unpacked, seeds a believable library, and
 * writes store/screenshot-*-1280x800.png. dist/manifest.json is patched
 * for this session only so the ChatGPT fixture on 127.0.0.1 gets the
 * real content scripts.
 */
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const STORE = path.join(ROOT, 'store')
const FIXTURE = path.join(__dirname, 'fixtures', 'chatgpt-mock.html')
const FIXTURE_PORT = 8766

const now = Date.now()
const day = 86_400_000

const SEED = [
  {
    text: 'Plan a 3-day trip to Lisbon for someone who hates crowds. Include one rainy-day option, two neighborhood walks, and a dinner reservation I can actually get.',
    platform: 'chatgpt',
    url: 'https://chatgpt.com/',
    tags: ['travel', 'weekend'],
    pinned: true,
    usageCount: 8,
    createdAt: now - 14 * day,
    lastUsedAt: now - 1 * day,
  },
  {
    text: 'Write a friendly but firm email to my landlord about {issue}. Keep it under 120 words, warm but direct, and end with a clear next step.',
    platform: 'claude',
    url: 'https://claude.ai/',
    tags: ['email'],
    pinned: false,
    usageCount: 5,
    createdAt: now - 21 * day,
    lastUsedAt: now - 2 * day,
  },
  {
    text: 'I need to tell {who} that {awkward thing}. Give me three ways to say it kindly, and tell me which one you’d pick.',
    platform: 'chatgpt',
    url: 'https://chatgpt.com/',
    tags: ['awkward'],
    pinned: false,
    usageCount: 3,
    createdAt: now - 9 * day,
    lastUsedAt: now - 4 * day,
  },
  {
    text: 'Plan 4 days of simple dinners for 2 people, using ordinary supermarket ingredients. Give me one shopping list at the end.',
    platform: 'gemini',
    url: 'https://gemini.google.com/',
    tags: ['everyday'],
    pinned: false,
    usageCount: 6,
    createdAt: now - 18 * day,
    lastUsedAt: now - 3 * day,
  },
  {
    text: 'Explain {topic} to me as if I know nothing about it. Use a real-world comparison, then tell me the one thing most people get wrong about it.',
    platform: 'claude',
    url: 'https://claude.ai/',
    tags: ['learning'],
    pinned: false,
    usageCount: 4,
    createdAt: now - 30 * day,
    lastUsedAt: now - 6 * day,
  },
  {
    text: 'Rewrite the message below so it sounds calm and professional, without losing what it actually says:\n\n{paste your message here}',
    platform: 'chatgpt',
    url: 'https://chatgpt.com/',
    tags: ['email', 'writing'],
    pinned: true,
    usageCount: 9,
    createdAt: now - 40 * day,
    lastUsedAt: now - day / 2,
  },
  {
    text: 'Help me think through {decision}. Give me the strongest case for each option, then tell me what you’d want to know before choosing.',
    platform: 'grok',
    url: 'https://grok.com/',
    tags: ['deciding'],
    pinned: false,
    usageCount: 2,
    createdAt: now - 11 * day,
    lastUsedAt: now - 8 * day,
  },
  {
    text: 'Write a short, friendly email to {who} about {situation}. Keep it under 120 words, warm but direct, and end with a clear next step.',
    platform: 'claude',
    url: 'https://claude.ai/',
    tags: ['email'],
    pinned: false,
    usageCount: 7,
    createdAt: now - 25 * day,
    lastUsedAt: now - 5 * day,
  },
  {
    text: 'Summarise the text below in five bullet points a busy person could read in twenty seconds:\n\n{paste the text here}',
    platform: 'deepseek',
    url: 'https://chat.deepseek.com/',
    tags: ['writing'],
    pinned: false,
    usageCount: 3,
    createdAt: now - 7 * day,
    lastUsedAt: now - 7 * day,
  },
  {
    text: 'I want to learn {skill} in {how much time}. Give me a realistic week-by-week plan, and say what to skip.',
    platform: 'gemini',
    url: 'https://gemini.google.com/',
    tags: ['learning'],
    pinned: false,
    usageCount: 2,
    createdAt: now - 16 * day,
    lastUsedAt: now - 10 * day,
  },
  {
    text: 'Write three versions of a {kind of post} about {topic}: one plain, one playful, one thoughtful. No hashtags, no emoji.',
    platform: 'chatgpt',
    url: 'https://chatgpt.com/',
    tags: ['writing'],
    pinned: false,
    usageCount: 1,
    createdAt: now - 5 * day,
    lastUsedAt: now - 5 * day,
  },
  {
    text: 'Turn this into a polite follow-up I can send tomorrow morning. Keep my point, drop the frustration:\n\n{paste the draft}',
    platform: 'claude',
    url: 'https://claude.ai/',
    tags: ['email'],
    pinned: false,
    usageCount: 4,
    createdAt: now - 3 * day,
    lastUsedAt: now - 3 * day,
  },
  {
    text: 'Suggest a rainy Saturday in my city that does not involve shopping. One museum-ish option, one food option, one if I just want to stay in.',
    platform: 'grok',
    url: 'https://grok.com/',
    tags: ['everyday', 'weekend'],
    pinned: false,
    usageCount: 2,
    createdAt: now - 2 * day,
    lastUsedAt: now - 2 * day,
  },
  {
    text: 'Help me pack for {trip} in a carry-on. Weather will be {weather}. I hate looking overdressed.',
    platform: 'gemini',
    url: 'https://gemini.google.com/',
    tags: ['travel'],
    pinned: false,
    usageCount: 3,
    createdAt: now - 8 * day,
    lastUsedAt: now - 6 * day,
  },
  {
    text: 'Give me a kind script for calling the clinic about {reason}. I freeze on the phone, so write it like I’m reading it.',
    platform: 'chatgpt',
    url: 'https://chatgpt.com/',
    tags: ['awkward'],
    pinned: false,
    usageCount: 2,
    createdAt: now - 6 * day,
    lastUsedAt: now - 6 * day,
  },
  {
    text: 'Make a one-page brief of {topic} I can read before a meeting. Headings, no jargon, three questions I should ask.',
    platform: 'deepseek',
    url: 'https://chat.deepseek.com/',
    tags: ['learning'],
    pinned: false,
    usageCount: 1,
    createdAt: now - 4 * day,
    lastUsedAt: now - 4 * day,
  },
  {
    text: 'Draft a thank-you note after {occasion}. Warm, specific, not gushy, under 80 words.',
    platform: 'claude',
    url: 'https://claude.ai/',
    tags: ['email', 'writing'],
    pinned: false,
    usageCount: 5,
    createdAt: now - 13 * day,
    lastUsedAt: now - 9 * day,
  },
  {
    text: 'Compare {option A} and {option B} for someone who cares more about time than money. End with your pick and why.',
    platform: 'grok',
    url: 'https://grok.com/',
    tags: ['deciding'],
    pinned: false,
    usageCount: 3,
    createdAt: now - 15 * day,
    lastUsedAt: now - 11 * day,
  },
]

function log(msg) {
  process.stdout.write(`→ ${msg}\n`)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function patchManifest() {
  const file = path.join(DIST, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  const extra = `http://127.0.0.1:${FIXTURE_PORT}/*`
  for (const cs of manifest.content_scripts ?? []) {
    if (cs.matches?.some((m) => m.includes('chatgpt.com')) && !cs.matches.includes(extra)) {
      cs.matches.push(extra)
    }
  }
  for (const war of manifest.web_accessible_resources ?? []) {
    if (Array.isArray(war.matches) && !war.matches.includes(extra)) war.matches.push(extra)
  }
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2))
}

function startFixtureServer() {
  const html = fs.readFileSync(FIXTURE)
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html)
  })
  return new Promise((resolve) => {
    server.listen(FIXTURE_PORT, '127.0.0.1', () => resolve(server))
  })
}

async function waitForDejaId(context) {
  let sw = context.serviceWorkers().find((w) => w.url().startsWith('chrome-extension://'))
  if (!sw) {
    sw = await context.waitForEvent('serviceworker', { timeout: 20_000 })
  }
  const id = new URL(sw.url()).hostname
  log(`service worker ${sw.url()}`)
  return id
}

async function waitForFonts(page) {
  await page.evaluate(() => document.fonts.ready)
  await sleep(150)
}

async function saveShot(page, name, pythonResize) {
  const dest = path.join(STORE, name)
  const tmp = dest.replace(/\.png$/, '.raw.png')
  await waitForFonts(page)
  await page.screenshot({ path: tmp, type: 'png' })
  pythonResize(tmp, dest)
  fs.unlinkSync(tmp)
  log(`wrote ${name}`)
}

function pythonResize(src, dest) {
  const { spawnSync } = require('node:child_process')
  const r = spawnSync(
    'python3',
    [
      '-c',
      `
from PIL import Image
im = Image.open(${JSON.stringify(src)}).convert('RGB')
# Crop to 16:10 if the capture is taller/wider, then lanczos to store size.
w, h = im.size
target_ratio = 1280 / 800
ratio = w / h
if abs(ratio - target_ratio) > 0.01:
    if ratio > target_ratio:
        nw = int(h * target_ratio)
        left = (w - nw) // 2
        im = im.crop((left, 0, left + nw, h))
    else:
        nh = int(w / target_ratio)
        top = (h - nh) // 2
        im = im.crop((0, top, w, top + nh))
im = im.resize((1280, 800), Image.Resampling.LANCZOS)
im.save(${JSON.stringify(dest)}, 'PNG')
`,
    ],
    { encoding: 'utf8' },
  )
  if (r.status !== 0) {
    throw new Error(r.stderr || 'PIL resize failed')
  }
}

function compositePopup(bgPath, popupPath, dest) {
  const { spawnSync } = require('node:child_process')
  const r = spawnSync(
    'python3',
    [
      '-c',
      `
from PIL import Image, ImageFilter, ImageDraw
bg = Image.open(${JSON.stringify(bgPath)}).convert('RGBA').resize((1280, 800), Image.Resampling.LANCZOS)
popup = Image.open(${JSON.stringify(popupPath)}).convert('RGBA')
# Scale popup to 360px wide, keep aspect.
pw = 360
ph = int(popup.height * (pw / popup.width))
popup = popup.resize((pw, ph), Image.Resampling.LANCZOS)
# Soft drop shadow
shadow = Image.new('RGBA', (pw + 40, ph + 40), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.rounded_rectangle((20, 22, 20 + pw, 22 + ph), 12, fill=(28, 27, 25, 55))
shadow = shadow.filter(ImageFilter.GaussianBlur(12))
card = Image.new('RGBA', popup.size, (0, 0, 0, 0))
mask = Image.new('L', popup.size, 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle((0, 0, pw - 1, ph - 1), 12, fill=255)
card.paste(popup, (0, 0), mask)
x, y = 1280 - pw - 28, 56
bg.alpha_composite(shadow, (x - 20, y - 18))
bg.alpha_composite(card, (x, y))
bg.convert('RGB').save(${JSON.stringify(dest)}, 'PNG')
`,
    ],
    { encoding: 'utf8' },
  )
  if (r.status !== 0) throw new Error(r.stderr || 'popup composite failed')
}

async function seedLibrary(page) {
  await page.evaluate(async (rows) => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('deja')
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const db = req.result
        if (![...db.objectStoreNames].includes('prompts')) {
          db.close()
          reject(new Error('prompts store missing'))
          return
        }
        const tx = db.transaction('prompts', 'readwrite')
        const store = tx.objectStore('prompts')
        store.clear()
        for (const row of rows) store.add(row)
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
    })
    const t = Date.now()
    const healthy = { ok: true, lastCheckedAt: t, lastHealthyAt: t }
    await chrome.storage.local.set({
      captureHealth: {
        chatgpt: healthy,
        claude: healthy,
        gemini: healthy,
        deepseek: healthy,
        grok: healthy,
      },
    })
  }, SEED)
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'manifest.json'))) {
    throw new Error('dist/ missing — run npm run build first')
  }

  let playwright
  try {
    playwright = require(path.join(ROOT, '.tmp/capture-tools/node_modules/playwright'))
  } catch {
    throw new Error(
      'playwright missing. Run: npm --prefix .tmp/capture-tools install playwright && npx --prefix .tmp/capture-tools playwright install chromium',
    )
  }
  const { chromium } = playwright

  fs.mkdirSync(STORE, { recursive: true })
  patchManifest()
  log('patched dist/manifest.json for 127.0.0.1 fixture')

  const server = await startFixtureServer()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'deja-store-shots-'))
  log(`chrome profile ${profile}`)

  const context = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light',
    args: [
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      '--enable-unsafe-extension-debugging',
      '--no-first-run',
      '--disable-infobars',
    ],
    ignoreDefaultArgs: ['--disable-extensions', '--enable-automation'],
  })

  try {
    const id = await waitForDejaId(context)
    log(`extension id ${id}`)

    const optionsUrl = `chrome-extension://${id}/src/options/index.html`
    const popupUrl = `chrome-extension://${id}/src/popup/index.html`
    const fixtureUrl = `http://127.0.0.1:${FIXTURE_PORT}/`

    const page = context.pages()[0] ?? (await context.newPage())
    await page.goto(optionsUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('text=My prompts', { timeout: 15_000 })
    await seedLibrary(page)
    log('seeded library + health')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector('text=prompts', { timeout: 15_000 })
    await sleep(600)

    // 3. Library — filter open so platform row + tags show.
    const filter = page.locator('summary', { hasText: 'Filter & sort' })
    await filter.click()
    await page.waitForSelector('text=From')
    await sleep(300)
    await saveShot(page, 'screenshot-3-library-1280x800.png', pythonResize)

    // 2. Search + sort — query in the box, sort control visible.
    await page.locator('[aria-label="Search your prompts"]').fill('email')
    await sleep(400)
    await saveShot(page, 'screenshot-2-search-sort-1280x800.png', pythonResize)

    // 5. Settings — hide the first block so save/site/PII fit the frame.
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.waitForSelector('text=Where Deja works')
    await page.evaluate(() => {
      const sections = [...document.querySelectorAll('section')]
      for (const s of sections) {
        const title = s.querySelector('h2')?.textContent ?? ''
        if (title === 'Suggestions while you type') s.style.display = 'none'
      }
      document.documentElement.style.zoom = '0.72'
    })
    await sleep(200)
    await saveShot(page, 'screenshot-5-settings-1280x800.png', pythonResize)

    // 4. Popup composited over the chat fixture.
    const chat = await context.newPage()
    await chat.setViewportSize({ width: 1280, height: 800 })
    chat.on('console', (msg) => log(`chat console ${msg.type()}: ${msg.text()}`))
    chat.on('pageerror', (err) => log(`chat error ${err.message}`))
    await chat.goto(fixtureUrl, { waitUntil: 'domcontentloaded' })
    await chat.waitForSelector('#prompt-textarea')
    await sleep(2000)
    const hosts = await chat.evaluate(() =>
      [...document.querySelectorAll('[data-deja]')].map((el) => el.getAttribute('data-deja')),
    )
    log(`deja hosts: ${JSON.stringify(hosts)}`)
    if (!hosts.length) {
      await chat.screenshot({ path: path.join(STORE, '_debug-chat.png'), type: 'png' })
      throw new Error(`content script did not attach (hosts=${JSON.stringify(hosts)})`)
    }
    const bgTmp = path.join(STORE, '_bg.png')
    await chat.screenshot({ path: bgTmp, type: 'png' })

    const popup = await context.newPage()
    await popup.setViewportSize({ width: 360, height: 520 })
    await popup.goto(popupUrl, { waitUntil: 'domcontentloaded' })
    await popup.waitForSelector('text=All prompts')
    await sleep(400)
    const popupTmp = path.join(STORE, '_popup.png')
    await popup.screenshot({ path: popupTmp, type: 'png' })
    compositePopup(bgTmp, popupTmp, path.join(STORE, 'screenshot-4-popup-1280x800.png'))
    log('wrote screenshot-4-popup-1280x800.png')
    await popup.close()
    fs.unlinkSync(bgTmp)
    fs.unlinkSync(popupTmp)

    // In-page shots on the fixture. Resurface first — opening the picker
    // suppresses the tooltip, so don't reverse these.
    await chat.bringToFront()
    await chat.setViewportSize({ width: 1280, height: 800 })

    await chat.click('#prompt-textarea')
    await chat.keyboard.type('Plan a 3-day trip to Lisbon for someone who hates crowds', {
      delay: 12,
    })
    await sleep(1800)
    await saveShot(chat, 'screenshot-1-resurface-1280x800.png', pythonResize)

    await chat.keyboard.press('Meta+A')
    await chat.keyboard.press('Backspace')
    await chat.keyboard.press('Escape')
    await sleep(200)

    await chat.keyboard.type('//land', { delay: 40 })
    await sleep(800)
    await saveShot(chat, 'screenshot-6-picker-1280x800.png', pythonResize)

    // 7. Dot panel — currently flagged off in presence.ts (PRESENCE_ENABLED).
    if (hosts.includes('presence')) {
      await chat.keyboard.press('Meta+A')
      await chat.keyboard.press('Backspace')
      await chat.keyboard.type('email', { delay: 30 })
      await sleep(400)
      const sendBox = await chat.locator('[data-testid="send-button"]').boundingBox()
      if (!sendBox) throw new Error('send button missing')
      await chat.mouse.click(sendBox.x - 22, sendBox.y + sendBox.height / 2)
      await sleep(700)
      await saveShot(chat, 'screenshot-7-dot-panel-1280x800.png', pythonResize)
    } else {
      log('SKIP screenshot-7: ambient dot is flagged off (PRESENCE_ENABLED=false)')
    }

    await chat.close()
    log('done')
  } finally {
    try {
      await context.close()
    } catch {
      /* ignore */
    }
    server.close()
    try {
      fs.rmSync(profile, { recursive: true, force: true })
    } catch {
      /* chrome may still be flushing the profile */
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
