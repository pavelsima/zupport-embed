import { css } from 'lit'

// Shadow-DOM-scoped reset. Inherited properties (font, color) still cross
// the boundary, so we explicitly normalise them on the panel root and rely
// on the host page to leave Shadow DOM alone otherwise.
export const reset = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  button {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    margin: 0;
    padding: 0;
    cursor: pointer;
  }

  textarea,
  input {
    font: inherit;
    color: inherit;
  }

  ol,
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  p {
    margin: 0;
  }
`
