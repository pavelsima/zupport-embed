// Inject the Fraunces + DM Sans + JetBrains Mono stylesheets once into the
// host page's <head>. Called from the auto-injecting `embed.ts` entrypoint
// so customers don't need to add a <link> tag themselves.
//
// `font-display: swap` ensures the widget renders immediately with the
// system-font fallback declared in tokens.ts and upgrades to the served
// faces once they arrive. If the host's CSP blocks fonts.googleapis.com,
// the fallback stack stays in place — the widget still renders, just
// without the warm-editorial typography.

const ANSWERLAY_FONT_LINK_ID = 'answerlay-fonts'
const FONT_HREF =
  'https://fonts.googleapis.com/css2' +
  '?family=Fraunces:opsz,wght@9..144,400..600' +
  '&family=DM+Sans:wght@400;500;700' +
  '&family=JetBrains+Mono:wght@400;500' +
  '&display=swap'

export function injectFonts(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(ANSWERLAY_FONT_LINK_ID)) return

  const preconnect1 = document.createElement('link')
  preconnect1.rel = 'preconnect'
  preconnect1.href = 'https://fonts.googleapis.com'

  const preconnect2 = document.createElement('link')
  preconnect2.rel = 'preconnect'
  preconnect2.href = 'https://fonts.gstatic.com'
  preconnect2.crossOrigin = ''

  const link = document.createElement('link')
  link.id = ANSWERLAY_FONT_LINK_ID
  link.rel = 'stylesheet'
  link.href = FONT_HREF

  document.head.appendChild(preconnect1)
  document.head.appendChild(preconnect2)
  document.head.appendChild(link)
}
