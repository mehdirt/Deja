#!/usr/bin/env node
/**
 * Record a social-ready demo GIF: thumbnail intro → save → resurface → // picker
 * → extension popup (pause + search).
 *
 * Usage:  npm run build && node scripts/capture-demo-gif.mjs
 * Output: store/deja-demo.gif (+ store/deja-demo.mp4)
 *
 * Requires: dist/ built, Playwright in .tmp/capture-tools, ffmpeg on PATH, python3+PIL.
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
const THUMBNAIL = path.join(ROOT, 'site', 'youtube-intro-thumbnail.png')
const FIXTURE_PORT = 8766
const FRAMES_DIR = path.join(ROOT, '.tmp', 'demo-gif-frames')
const OUT_GIF = path.join(STORE, 'deja-demo.gif')
const OUT_MP4 = path.join(STORE, 'deja-demo.mp4')

const VIEWPORT = { width: 1280, height: 800 }
const FPS = 15
const FRAME_MS = 1000 / FPS
/** Stretch holds + beat counts so the demo can breathe (tune here). */
const PACE = 1.65

function beats(n) {
  return Math.round(n * PACE)
}

const now = Date.now()
const day = 86_400_000

/** Saved library row — the polished prompt resurface should offer back. */
const SAVED_LISBON =
  'Plan a 3-day trip to Lisbon for someone who hates crowds. Include one rainy-day option, two neighborhood walks, and a dinner reservation I can actually get.'
/** Scene 1: unrelated fresh save (not the resurface target). */
const DEMO_SAVE_PROMPT =
  "What's a polite way to ask my neighbor to quiet down after 10pm without sounding passive-aggressive?"
/** Scene 2: rough re-ask — similar intent, different wording (triggers resurface, not a copy-paste). */
const DEMO_RESURFACE_TYPING =
  'help me plan a 3-day trip to Lisbon for someone who hates tourist crowds'

/** Minimal seed — landlord row must rank for //landlord and popup search. */
const SEED = [
  {
    text: SAVED_LISBON,
    platform: 'chatgpt',
    url: 'https://chatgpt.com/',
    tags: ['travel'],
    pinned: true,
    usageCount: 12,
    createdAt: now - 14 * day,
    lastUsedAt: now - 1 * day,
  },
  {
    text: 'Write a friendly but firm email to my landlord about {issue}. Keep it under 120 words, warm but direct, and end with a clear next step.',
    platform: 'claude',
    url: 'https://claude.ai/',
    tags: ['email', 'landlord'],
    pinned: false,
    usageCount: 9,
    createdAt: now - 21 * day,
    lastUsedAt: now - 2 * day,
  },
  {
    text: 'Write a short, friendly email to my landlord about {issue}. Keep it under 120 words.',
    platform: 'chatgpt',
    url: 'https://chatgpt.com/',
    tags: ['email'],
    pinned: false,
    usageCount: 6,
    createdAt: now - 10 * day,
    lastUsedAt: now - 3 * day,
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
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html)
  })
  return new Promise((resolve) => {
    server.listen(FIXTURE_PORT, '127.0.0.1', () => resolve(server))
  })
}

async function waitForDejaId(context) {
  let sw = context.serviceWorkers().find((w) => w.url().startsWith('chrome-extension://'))
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 25_000 })
  return new URL(sw.url()).hostname
}

async function seedLibrary(page) {
  await page.evaluate(async (rows) => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('deja')
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('prompts', 'readwrite')
        tx.objectStore('prompts').clear()
        for (const row of rows) tx.objectStore('prompts').add(row)
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
      captureHealth: { chatgpt: healthy, claude: healthy, gemini: healthy, deepseek: healthy, grok: healthy },
      pauseUntil: 0,
    })
  }, SEED)
}

function compositePopup(bgPath, popupPath, dest, opacity = 1) {
  const r = spawnSync(
    'python3',
    [
      '-c',
      `
from PIL import Image, ImageFilter, ImageDraw
bg = Image.open(${JSON.stringify(bgPath)}).convert('RGBA').resize((1280, 800), Image.Resampling.LANCZOS)
popup = Image.open(${JSON.stringify(popupPath)}).convert('RGBA')
pw = 360
ph = int(popup.height * (pw / popup.width))
popup = popup.resize((pw, ph), Image.Resampling.LANCZOS)
if ${opacity} < 1:
    a = popup.split()[3].point(lambda p: int(p * ${opacity}))
    popup.putalpha(a)
shadow = Image.new('RGBA', (pw + 40, ph + 40), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.rounded_rectangle((20, 22, 20 + pw, 22 + ph), 12, fill=(28, 27, 25, int(55 * ${opacity})))
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

function padThumbnailToFrames(count) {
  const r = spawnSync(
    'python3',
    [
      '-c',
      `
from PIL import Image
thumb = Image.open(${JSON.stringify(THUMBNAIL)}).convert('RGB')
bg = Image.new('RGB', (${VIEWPORT.width}, ${VIEWPORT.height}), (250, 248, 243))
tw, th = thumb.size
scale = min(${VIEWPORT.width} / tw, ${VIEWPORT.height} / th)
nw, nh = int(tw * scale), int(th * scale)
thumb = thumb.resize((nw, nh), Image.Resampling.LANCZOS)
x = (${VIEWPORT.width} - nw) // 2
y = (${VIEWPORT.height} - nh) // 2
bg.paste(thumb, (x, y))
for i in range(${count}):
    bg.save(${JSON.stringify(path.join(FRAMES_DIR, 'frame'))} + f'_{i:05d}.png')
`,
    ],
    { encoding: 'utf8' },
  )
  if (r.status !== 0) throw new Error(r.stderr || 'thumbnail pad failed')
}

class DemoRecorder {
  constructor({ chatPage, popupPage, startIndex }) {
    this.chatPage = chatPage
    this.popupPage = popupPage
    this.index = startIndex
    this.holdUntil = 0
    this.popupVisible = false
    this.popupOpacity = 1
    this.bgTmp = path.join(FRAMES_DIR, '_bg_tmp.png')
    this.popupTmp = path.join(FRAMES_DIR, '_popup_tmp.png')
  }

  setPopup(visible, opacity = 1) {
    this.popupVisible = visible
    this.popupOpacity = opacity
  }

  async tick() {
    const now = Date.now()
    if (now < this.holdUntil) return
    const dest = path.join(FRAMES_DIR, `frame_${String(this.index).padStart(5, '0')}.png`)
    await this.chatPage.screenshot({ path: this.bgTmp, type: 'png' })
    if (this.popupVisible && this.popupPage) {
      await this.popupPage.screenshot({ path: this.popupTmp, type: 'png' })
      compositePopup(this.bgTmp, this.popupTmp, dest, this.popupOpacity)
    } else {
      fs.copyFileSync(this.bgTmp, dest)
    }
    this.index++
    this.holdUntil = now + FRAME_MS
  }

  /** Capture N frames (wall-clock paced at FPS). */
  async frames(n) {
    for (let i = 0; i < n; i++) await this.tick()
  }

  async hold(ms) {
    const end = Date.now() + ms
    while (Date.now() < end) await this.tick()
  }
}

/** Type with a screenshot after every few characters so typing reads on the GIF. */
async function typeGradually(rec, page, text, { charsPerFrame = 1, dwellMs = 52 } = {}) {
  let chunk = ''
  for (let i = 0; i < text.length; i++) {
    chunk += text[i]
    const last = i === text.length - 1
    if (chunk.length >= charsPerFrame || last) {
      await page.keyboard.type(chunk, { delay: 0 })
      chunk = ''
      await rec.tick()
      await rec.tick()
      await sleep(dwellMs)
    }
  }
}

async function injectChromeToolbar(page, extId) {
  const iconUrl = `chrome-extension://${extId}/src/assets/icon-48.png`
  await page.evaluate((icon) => {
    if (document.getElementById('demo-chrome-bar')) return
    const style = document.createElement('style')
    style.textContent = `
      #demo-chrome-bar {
        position: fixed; top: 0; left: 0; right: 0; height: 40px; z-index: 2147483646;
        background: linear-gradient(#f8f9fa, #eceff1);
        border-bottom: 1px solid #dadce0;
        display: flex; align-items: center; justify-content: flex-end;
        padding: 0 14px; gap: 10px; font: 12px system-ui, sans-serif; color: #5f6368;
      }
      #demo-chrome-bar .slot {
        width: 28px; height: 28px; border-radius: 50%; background: #e8eaed;
        display: grid; place-items: center; font-size: 14px;
      }
      #demo-deja-icon {
        width: 28px; height: 28px; border-radius: 6px; cursor: pointer;
        border: 2px solid transparent; transition: border-color 0.1s, box-shadow 0.1s;
      }
      #demo-deja-icon.active {
        border-color: #5b54f0;
        box-shadow: 0 0 0 3px rgba(91, 84, 240, 0.25);
      }
      body { padding-top: 40px !important; }
    `
    document.head.appendChild(style)
    const bar = document.createElement('div')
    bar.id = 'demo-chrome-bar'
    bar.innerHTML = `
      <span style="margin-right:auto;padding-left:6px;opacity:.7">ChatGPT — Mock</span>
      <span class="slot" title="Extensions">🧩</span>
      <img id="demo-deja-icon" alt="Deja" title="Deja" />
    `
    document.body.prepend(bar)
    const img = document.getElementById('demo-deja-icon')
    if (img) img.src = icon
  }, iconUrl)
}

async function setDejaIconActive(page, active) {
  await page.evaluate((on) => {
    document.getElementById('demo-deja-icon')?.classList.toggle('active', on)
  }, active)
}

async function clearComposer(page) {
  await page.click('#prompt-textarea')
  await page.keyboard.press('Meta+A')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Escape')
  await sleep(200)
}

async function fadeInPopup(rec, steps = 8) {
  rec.setPopup(true, 0.12)
  await rec.frames(2)
  for (let i = 2; i <= steps; i++) {
    rec.setPopup(true, i / steps)
    await rec.frames(2)
  }
  rec.setPopup(true, 1)
  await rec.frames(3)
}

function assembleGif() {
  const pattern = path.join(FRAMES_DIR, 'frame_%05d.png')
  const first = path.join(FRAMES_DIR, 'frame_00000.png')
  if (!fs.existsSync(first)) throw new Error('no frames captured')

  const palette = path.join(FRAMES_DIR, 'palette.png')
  const r1 = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      String(FPS),
      '-i',
      pattern,
      '-vf',
      `fps=${FPS},scale=1280:800:flags=lanczos,palettegen=stats_mode=diff`,
      palette,
    ],
    { encoding: 'utf8' },
  )
  if (r1.status !== 0) throw new Error(r1.stderr || 'palettegen failed')

  const r2 = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      String(FPS),
      '-i',
      pattern,
      '-i',
      palette,
      '-lavfi',
      `fps=${FPS},scale=1280:800:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
      OUT_GIF,
    ],
    { encoding: 'utf8' },
  )
  if (r2.status !== 0) throw new Error(r2.stderr || 'gif encode failed')

  spawnSync(
    'ffmpeg',
    ['-y', '-framerate', String(FPS), '-i', pattern, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', OUT_MP4],
    { encoding: 'utf8' },
  )
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'manifest.json'))) {
    throw new Error('dist/ missing — run npm run build first')
  }
  if (!fs.existsSync(THUMBNAIL)) {
    throw new Error(`thumbnail missing: ${THUMBNAIL}`)
  }

  const ff = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
  if (ff.status !== 0) throw new Error('ffmpeg not found on PATH')

  let playwright
  try {
    playwright = require(path.join(ROOT, '.tmp/capture-tools/node_modules/playwright'))
  } catch {
    throw new Error(
      'playwright missing. Run: npm --prefix .tmp/capture-tools install playwright && npx --prefix .tmp/capture-tools playwright install chromium',
    )
  }
  const { chromium } = playwright

  fs.mkdirSync(FRAMES_DIR, { recursive: true })
  for (const f of fs.readdirSync(FRAMES_DIR)) fs.unlinkSync(path.join(FRAMES_DIR, f))

  patchManifest()
  const server = await startFixtureServer()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'deja-demo-gif-'))

  const context = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: VIEWPORT,
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
    log(`extension ${id}`)

    const optionsUrl = `chrome-extension://${id}/src/options/index.html`
    const popupUrl = `chrome-extension://${id}/src/popup/index.html`
    const fixtureUrl = `http://127.0.0.1:${FIXTURE_PORT}/`

    const setup = context.pages()[0] ?? (await context.newPage())
    await setup.goto(optionsUrl, { waitUntil: 'domcontentloaded' })
    await setup.waitForSelector('text=My prompts', { timeout: 20_000 })
    await seedLibrary(setup)
    log('library seeded')
    await setup.close()

    const chatPage = await context.newPage()
    await chatPage.goto(fixtureUrl, { waitUntil: 'domcontentloaded' })
    await chatPage.waitForSelector('#prompt-textarea')
    await injectChromeToolbar(chatPage, id)
    await sleep(1200)

    const hosts = await chatPage.evaluate(() =>
      [...document.querySelectorAll('[data-deja]')].map((el) => el.getAttribute('data-deja')),
    )
    if (!hosts.length) throw new Error('content scripts did not attach')

    const popupPage = await context.newPage()
    await popupPage.setViewportSize({ width: 360, height: 520 })
    await popupPage.goto(popupUrl, { waitUntil: 'domcontentloaded' })
    await popupPage.waitForSelector('text=Quietly saving', { timeout: 15_000 })

    // ── Intro: thumbnail hold (~3.5s) ─────────────────────────────────────
    const introFrames = Math.round(3.5 * FPS)
    padThumbnailToFrames(introFrames)
    const rec = new DemoRecorder({ chatPage, popupPage, startIndex: introFrames })

    // ── Scene 1: passive save + toast ─────────────────────────────────────
    log('scene: save')
    await rec.frames(beats(8))
    await chatPage.click('#prompt-textarea')
    await rec.frames(beats(4))
    const savePrompt = DEMO_SAVE_PROMPT
    await typeGradually(rec, chatPage, savePrompt, { charsPerFrame: 2, dwellMs: 48 })
    await rec.frames(beats(14))
    await chatPage.click('button[data-testid="send-button"]')
    await sleep(450)
    await rec.hold(4200 * PACE)

    // ── Scene 2: resurface while retyping ─────────────────────────────────
    log('scene: resurface')
    await clearComposer(chatPage)
    await rec.frames(beats(10))
    await chatPage.click('#prompt-textarea')
    await rec.frames(beats(4))
    await typeGradually(rec, chatPage, DEMO_RESURFACE_TYPING, {
      charsPerFrame: 1,
      dwellMs: 55,
    })
    await sleep(900)
    await rec.hold(4800 * PACE)

    // ── Scene 3: // picker + fill-in ──────────────────────────────────────
    log('scene: // picker')
    await clearComposer(chatPage)
    await rec.frames(beats(10))
    await chatPage.click('#prompt-textarea')
    await rec.frames(beats(4))
    await typeGradually(rec, chatPage, '//landlord', { charsPerFrame: 1, dwellMs: 70 })
    await sleep(700)
    await rec.frames(beats(18))
    await chatPage.keyboard.press('Enter')
    await sleep(550)
    await rec.hold(4000 * PACE)

    // ── Scene 4: extension popup — pause, resume, search ────────────────────
    log('scene: extension popup')
    rec.setPopup(false)
    await rec.frames(beats(14))

    await setDejaIconActive(chatPage, true)
    await rec.frames(beats(6))
    await chatPage.click('#demo-deja-icon')
    await fadeInPopup(rec, beats(8))
    await rec.frames(beats(20))

    await popupPage.bringToFront()
    await popupPage.getByRole('button', { name: 'Pause' }).click()
    await sleep(200)
    await rec.frames(beats(8))
    await popupPage.getByRole('menuitem', { name: 'Pause for an hour' }).click()
    await sleep(280)
    await rec.frames(beats(30))

    await popupPage.getByRole('button', { name: 'Resume' }).click()
    await sleep(280)
    await rec.frames(beats(22))

    const search = popupPage.locator('[aria-label="Search your prompts"]')
    await search.click()
    await rec.frames(beats(4))
    await typeGradually(rec, popupPage, 'landlord', { charsPerFrame: 1, dwellMs: 65 })
    await sleep(450)
    await rec.hold(3600 * PACE)

    await setDejaIconActive(chatPage, false)
    await rec.frames(beats(12))

    log(`captured ${rec.index} frames`)
    assembleGif()
    log(`wrote ${OUT_GIF}`)
    if (fs.existsSync(OUT_MP4)) log(`wrote ${OUT_MP4}`)
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
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
