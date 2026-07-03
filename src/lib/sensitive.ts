// Default-on protection against ever capturing credentials or other secrets.
//
// This is NOT the user-configurable blocklist. It ships ON for everyone and
// cannot be turned off, because "don't store the user's password" is not a
// preference — it's a baseline guarantee.
//
// Two ideas do all the work:
//   1. The prompt composer on every supported site is a <textarea> or a
//      contenteditable element — NEVER a plain <input>. So we only ever treat
//      textarea/contenteditable as capturable. Excluding <input> removes
//      password, email, search, tel, number, and every other input field in a
//      single move.
//   2. Belt-and-suspenders: even for textarea/contenteditable, refuse capture
//      if the field — or the form it lives in — looks like a login, OTP, or
//      payment context.
//
// Pure + DOM-only (no storage, no async), safe to call synchronously in the
// capture hot path, and unit-testable under happy-dom.

// Names / ids / labels that signal a secret. Word-ish boundaries keep this from
// firing on innocent prompts (we only ever test field *attributes*, never the
// prompt text, so false positives just mean "don't capture this field").
// Over-matching here is the SAFE direction: the worst case is we decline to
// capture a field, and the only field we must capture (the prompt composer)
// never carries these tokens in its name/id/label.
const SENSITIVE_ATTR_RE =
  /pass(word|wd|phrase|code)?|pwd|otp|one[-_ ]?time|2fa|mfa|secret|api[-_ ]?key|\btoken\b|\bcvc\b|\bcvv\b|card[-_ ]?number|credit[-_ ]?card|\bssn\b|\bpin\b|security[-_ ]?code|verification[-_ ]?code|recovery|seed[-_ ]?phrase|mnemonic/i

// autocomplete tokens the browser itself marks as sensitive.
const SENSITIVE_AUTOCOMPLETE = new Set([
  'current-password',
  'new-password',
  'one-time-code',
  'cc-number',
  'cc-csc',
  'cc-exp',
])

function attrsLookSensitive(el: Element): boolean {
  const probe = [
    el.getAttribute('name'),
    el.getAttribute('id'),
    el.getAttribute('aria-label'),
    el.getAttribute('placeholder'),
    el.getAttribute('data-testid'),
  ]
    .filter(Boolean)
    .join(' ')
  if (probe && SENSITIVE_ATTR_RE.test(probe)) return true

  const ac = (el.getAttribute('autocomplete') || '').toLowerCase().trim()
  if (ac && SENSITIVE_AUTOCOMPLETE.has(ac)) return true

  return false
}

/**
 * True if this element is (or sits inside) a credential / OTP / payment
 * context and must never be captured.
 */
export function isSensitiveField(el: Element | null): boolean {
  if (!el) return false

  // A password input anywhere is an immediate no.
  if (el instanceof HTMLInputElement && el.type === 'password') return true

  if (attrsLookSensitive(el)) return true

  // If the field lives in a container that ALSO holds a password input, treat
  // the whole container as a credential context. This covers a username box or
  // a contenteditable sitting next to a password field on a login screen.
  // We look beyond <form> to role="form" and modal dialogs, because modern SPA
  // auth UIs frequently render login fields with no real <form> element.
  if (typeof el.closest === 'function') {
    const container = el.closest(
      'form, [role="form"], dialog, [role="dialog"], [aria-modal="true"]',
    )
    if (container && container.querySelector('input[type="password"]')) return true
  }

  return false
}

/**
 * The ONLY elements we are ever allowed to capture from: a real textarea or a
 * contenteditable, and only when it is not a sensitive field. Plain <input>
 * elements (including type="password") are never capturable.
 */
export function isContentEditable(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  // Fall back to the attribute: covers detached/test elements and is true for
  // contenteditable="", "true", and "plaintext-only" (anything but "false").
  const attr = el.getAttribute('contenteditable')
  return attr != null && attr.toLowerCase() !== 'false'
}

export function isCapturableField(el: Element | null): el is HTMLElement {
  if (!el) return false
  const isTextarea = el instanceof HTMLTextAreaElement
  if (!isTextarea && !isContentEditable(el)) return false
  if (isSensitiveField(el)) return false
  return true
}

/**
 * Capture precision: only accept an editable that belongs to the site's known
 * prompt composer. If the composer can't be located (selectors drifted, or
 * we're on a non-chat page like a login screen), `composer` is null and we
 * fall back to the field-eligibility checks above — which already exclude
 * sensitive fields, so the login screen still captures nothing.
 */
export function withinComposer(el: Element, composer: Element | null): boolean {
  if (!composer) return true
  return el === composer || composer.contains(el) || el.contains(composer)
}

// Paths that signal a login/auth screen. When we can't find the composer AND
// the path looks like auth, capture nothing — defense in depth for SPA login
// widgets that aren't a <form> and carry no obviously-sensitive attributes.
const AUTH_PATH_RE =
  /(^|\/)(login|log[-_]?in|sign[-_]?in|sign[-_]?up|register|auth|oauth|sso|account\/?(login|signin)?|password|reset|verify|otp|mfa|2fa)(\/|$|\?)/i

export function looksLikeAuthPath(pathname: string): boolean {
  return AUTH_PATH_RE.test(pathname || '')
}

// Strip query and fragment before storing a capture URL. Magic-link, OAuth, and
// SSO callbacks routinely carry secrets in `?token=`/`#access_token=`/`?code=`,
// and a stored URL travels in the JSON export the user may share. We keep only
// origin + pathname — enough to know which site/path a prompt came from.
export function safeCaptureUrl(href: string): string {
  try {
    const u = new URL(href)
    return u.origin + u.pathname
  } catch {
    // Not a parseable URL — drop everything after the first ? or # defensively.
    return (href || '').split(/[?#]/)[0]
  }
}
