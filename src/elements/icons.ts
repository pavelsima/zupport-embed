import { html, svg } from 'lit'

export const chatIcon = svg`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2.2"
  stroke-linecap="round"
  stroke-linejoin="round"
  width="24"
  height="24"
  aria-hidden="true"
>
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
</svg>`

export const closeIcon = svg`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  width="18"
  height="18"
  aria-hidden="true"
>
  <line x1="18" y1="6" x2="6" y2="18"></line>
  <line x1="6" y1="6" x2="18" y2="18"></line>
</svg>`

export const sendIcon = svg`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2.2"
  stroke-linecap="round"
  stroke-linejoin="round"
  width="16"
  height="16"
  aria-hidden="true"
>
  <line x1="22" y1="2" x2="11" y2="13"></line>
  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
</svg>`

export const checkIcon = svg`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="3"
  stroke-linecap="round"
  stroke-linejoin="round"
  width="14"
  height="14"
  aria-hidden="true"
>
  <polyline points="20 6 9 17 4 12"></polyline>
</svg>`

export const spinnerIcon = svg`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2.4"
  stroke-linecap="round"
  width="14"
  height="14"
  class="spinner"
  aria-hidden="true"
>
  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
</svg>`

export const alertIcon = svg`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  width="14"
  height="14"
  aria-hidden="true"
>
  <circle cx="12" cy="12" r="10"></circle>
  <line x1="12" y1="8" x2="12" y2="12"></line>
  <line x1="12" y1="16" x2="12.01" y2="16"></line>
</svg>`

export const sparkleIcon = svg`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linejoin="round"
  width="11"
  height="11"
  aria-hidden="true"
>
  <polygon points="12 2 13.09 8.26 19 9 14.14 13.14 15.5 19 12 16 8.5 19 9.86 13.14 5 9 10.91 8.26 12 2"></polygon>
</svg>`

export const dotsIcon = svg`<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="currentColor"
  width="14"
  height="14"
  aria-hidden="true"
>
  <circle cx="5" cy="12" r="1.6"></circle>
  <circle cx="12" cy="12" r="1.6"></circle>
  <circle cx="19" cy="12" r="1.6"></circle>
</svg>`

// CSS-only "two overlapping rounded rectangles" logo mark. The actual
// rectangles are drawn by .logo-mark::before / ::after in component.ts and
// reuse --answerlay-brand and --answerlay-accent so the mark inherits the
// configured brand color. `size` is forwarded as a CSS custom property so
// the same template can render at avatar / credit / hero sizes.
export const logoMark = (size = 22) =>
  html`<span
    class="logo-mark"
    style="--logo-size: ${size}px"
    aria-hidden="true"
  ></span>`
