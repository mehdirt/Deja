import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { githubIssueHref } from './feedback'

// The in-app feedback buttons prefill GitHub issue forms by query param, and
// GitHub matches those params against the `id:` of each field. A mismatch is
// SILENT — no error, no warning, the value is just dropped — so nothing at
// runtime can catch a renamed field or a deleted form. This test is the only
// thing standing between a tidy-up of the YAML and a feedback link that quietly
// stops carrying what we asked the user for.

const TEMPLATE_DIR = resolve(__dirname, '../../.github/ISSUE_TEMPLATE')

function templateSource(file: string): string {
  return readFileSync(resolve(TEMPLATE_DIR, file), 'utf8')
}

/**
 * Field ids declared in an issue form, read without a YAML dependency.
 *
 * Deliberately fails closed: if the forms are ever reindented and this stops
 * matching, it returns nothing and the assertions below fail loudly, rather
 * than passing vacuously and letting real drift through.
 */
function fieldIds(source: string): string[] {
  return [...source.matchAll(/^\s{4}id:\s*([\w-]+)\s*$/gm)].map((m) => m[1])
}

const KINDS = ['problem', 'idea', 'capture'] as const

describe('feedback links match the issue forms', () => {
  it('every form the code links to exists on disk', () => {
    const present = readdirSync(TEMPLATE_DIR)
    for (const kind of KINDS) {
      const template = new URL(githubIssueHref(kind)).searchParams.get('template')
      expect(template, kind).toBeTruthy()
      expect(present, `${kind} → ${template}`).toContain(template)
    }
  })

  it('can actually read field ids out of the forms', () => {
    // Guards the guard: everything below is vacuous if this returns nothing.
    for (const file of readdirSync(TEMPLATE_DIR).filter((f) => f !== 'config.yml')) {
      expect(fieldIds(templateSource(file)).length, file).toBeGreaterThan(0)
    }
  })

  it('every prefilled param matches a field id in its form', () => {
    // Exercise both context shapes: a bare platform label (aimed at the site
    // dropdown) and a sentence (aimed at free text).
    for (const context of ['ChatGPT', 'capture broken on ChatGPT, Claude']) {
      for (const kind of KINDS) {
        const params = new URL(githubIssueHref(kind, context, '0.5.0')).searchParams
        const template = params.get('template')!
        const ids = fieldIds(templateSource(template))
        for (const [key] of params) {
          if (key === 'template') continue
          expect(ids, `${template} has no field "${key}"`).toContain(key)
        }
      }
    }
  })

  it('keeps blank issues closed so reports arrive with the questions answered', () => {
    expect(templateSource('config.yml')).toMatch(/blank_issues_enabled:\s*false/)
  })

  it('asks every reporter to check for personal information', () => {
    // Deja's whole promise is that prompt text stays on the machine. A public
    // issue is the one place a user might paste it themselves, so each form
    // has to say so.
    for (const file of readdirSync(TEMPLATE_DIR).filter((f) => f !== 'config.yml')) {
      expect(templateSource(file).toLowerCase(), file).toMatch(
        /personal information|prompt text/,
      )
    }
  })
})
