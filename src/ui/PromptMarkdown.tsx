import { isValidElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { Components } from 'react-markdown'

/** Tight allowlist — no raw HTML, scripts, or exotic tags. */
const SCHEMA = {
  ...defaultSchema,
  tagNames: [
    'p',
    'ul',
    'ol',
    'li',
    'strong',
    'em',
    'a',
    'code',
    'pre',
    'h1',
    'h2',
    'h3',
    'blockquote',
    'hr',
    'br',
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: ['href', 'title'],
    // Keep language-* on fenced code so the renderer can show a lang chip.
    code: [['className', /^language-[\w+-]+$/]],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https'],
  },
}

function langFromClass(className: unknown): string | undefined {
  if (typeof className !== 'string') return undefined
  return /language-([\w+-]+)/.exec(className)?.[1]
}

function codeChildClass(children: ReactNode): string | undefined {
  if (!isValidElement(children)) return undefined
  const props = children.props as { className?: string }
  return props.className
}

const components: Components = {
  a({ href, children }) {
    if (!href || !/^https?:\/\//i.test(href)) {
      return <span>{children}</span>
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  },
  pre({ children }) {
    const lang = langFromClass(codeChildClass(children))
    return (
      <div className="dj-md-fence">
        {lang ? <div className="dj-md-lang">{lang}</div> : null}
        <pre className="dj-md-pre">{children}</pre>
      </div>
    )
  },
  code({ className, children }) {
    const lang = langFromClass(className)
    // Fenced blocks land here with a language-* class (inside our <pre>).
    if (lang || (typeof children === 'string' && children.includes('\n'))) {
      return <code className="dj-md-pre-code">{children}</code>
    }
    return <code className="dj-md-code">{children}</code>
  },
}

/** Safe markdown view for a prompt body. Caller passes already-truncated text. */
export function PromptMarkdown({ text }: { text: string }) {
  return (
    <div className="dj-md">
      <ReactMarkdown rehypePlugins={[[rehypeSanitize, SCHEMA]]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  )
}
