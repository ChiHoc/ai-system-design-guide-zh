const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

/** 把上游使用的 ASCII 数学记号转换为浏览器可显示的上下标。 */
export function formatMathNotation(value) {
  return escapeHtml(value)
    .replace(/([A-Za-z0-9)])\^(\([^\n)]+\)|[A-Za-z0-9]+)/g, '$1<sup>$2</sup>')
    .replace(/([A-Za-z])_([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z][A-Za-z0-9]*)*)/g, '$1<sub>$2</sub>')
}

/** 只接管以等式为主的无语言围栏，避免把代码和 ASCII 图误判为公式。 */
export function isFormulaFence(value) {
  const lines = value.split('\n').map((line) => line.trim()).filter(Boolean)
  if (!lines.length || /[│┌┐└┘├┤┬┴]|-->|<--|#|\b(?:return|def|class|import|from|Embed)\b/.test(value)) return false
  const equations = lines.filter((line) => (
    /^[=≈]/.test(line)
    || /^[A-Za-z][A-Za-z0-9_ ]*(?:\([^=]*\))?\s*(?:=|≈)/.test(line)
  ))
  return equations.length >= Math.ceil(lines.length / 2)
}

/** 判断普通 Markdown 文本是否包含需要排版的数学记号。 */
export function hasMathNotation(value) {
  return /[√≈∑Σ∏∝≤≥]|\b[A-Z]{1,3}\^[A-Za-z0-9]|\b(?:d|n|W|PE|pos)_[A-Za-z]/.test(value)
}
