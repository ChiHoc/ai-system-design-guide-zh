import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'

const rControl = /[\u0000-\u001f]/g
const rSpecial = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g
const rCombining = /[\u0300-\u036F]/g

/** 与 VitePress 默认实现一致的标题 slug。 */
export function slugifyHeading(title) {
  return title.normalize('NFKD').replace(rCombining, '').replace(rControl, '').replace(rSpecial, '-')
    .replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').replace(/^(\d)/, '_$1').toLowerCase()
}

function headingAnchors(markdown) {
  const counts = new Map()
  const anchors = new Set([...markdown.matchAll(/<a\s+[^>]*id=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]))
  for (const line of markdown.split('\n').filter((candidate) => /^#{1,6}\s/.test(candidate))) {
    const title = line.replace(/^#{1,6}\s+/, '').replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
      .replace(/<[^>]+>/g, '').replace(/[`*_]/g, '')
    const base = slugifyHeading(title)
    const count = counts.get(base) ?? 0
    anchors.add(count === 0 ? base : `${base}-${count}`)
    counts.set(base, count + 1)
  }
  return anchors
}

/** 提取代码围栏；Mermaid 允许翻译可见标签，因此单独排除。 */
export function codeBlocks(markdown) {
  return [...markdown.matchAll(/^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1\s*$/gm)]
    .filter((match) => match[2].trim() !== 'mermaid')
    .map((match) => `${match[2].trim()}\n${match[3]}`)
}

/** 只比较 Mermaid 的拓扑标记与声明数量，允许节点可见标签翻译。 */
export function mermaidShape(markdown) {
  return [...markdown.matchAll(/^(`{3,}|~{3,})mermaid\s*\n([\s\S]*?)^\1\s*$/gm)].map((match) => {
    const diagram = match[2]
    const count = (pattern) => [...diagram.matchAll(pattern)].length
    return {
      lines: diagram.split('\n').filter((line) => line.trim() && !line.trim().startsWith('%%')).length,
      arrows: [...diagram.matchAll(/-->>|-.->|==>|->>|--x|--\)|-->|---/g)].map((item) => item[0]).sort(),
      square: count(/\b[\w-]+\s*\[/g),
      round: count(/\b[\w-]+\s*\(/g),
      curly: count(/\b[\w-]+\s*\{/g),
      declarations: count(/^\s*(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|journey|pie|mindmap|timeline|participant|actor|class|state|subgraph)\b/gm),
    }
  })
}

export function headingShape(markdown) {
  return markdown.split('\n')
    .filter((line) => /^#{1,6}\s/.test(line))
    .map((line) => line.match(/^#+/)[0].length)
}

export function numericTokens(markdown) {
  const scale = {
    k: 1_000, thousand: 1_000, m: 1_000_000, million: 1_000_000,
    b: 1_000_000_000, billion: 1_000_000_000, trillion: 1_000_000_000_000,
    万: 10_000, 亿: 100_000_000, 万亿: 1_000_000_000_000,
  }
  const pattern = /(?<![A-Za-z_])(\d+(?:[.,]\d+)*)(?:(万亿|[KMB%万亿])|\s+(thousand|million|billion|trillion|percent|万亿|万|亿|%)(?![A-Za-z]))?/gu
  return [...new Set([...markdown.matchAll(pattern)].map((match) => {
    const unitName = match[2] ?? match[3]
    const unit = scale[unitName?.toLowerCase()] ?? 1
    return String(Number(match[1].replaceAll(',', '')) * unit)
  }))].sort()
}

export function linkTargets(markdown) {
  return [...markdown.matchAll(/!?(?:\[[^\]]*\])\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map((match) => match[1])
}

export function tableShape(markdown) {
  return markdown.split('\n')
    .filter((line) => /^\s*\|.*\|\s*$/.test(line))
    .map((line) => line.split('|').length)
}

/** 找出疑似整段漏译的英文正文；代码、HTML、表格和参考条目不参与。 */
export function untranslatedBlocks(markdown) {
  const withoutFences = markdown.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '')
  return withoutFences.split(/\n\s*\n/).filter((block) => {
    const text = block.trim()
    if (!text || /^(?:[-|<]|#{1,6}\s)/.test(text)) return false
    const latinWords = text.match(/\b[A-Za-z]{3,}\b/g)?.length ?? 0
    const han = text.match(/\p{Script=Han}/gu)?.length ?? 0
    return text.length >= 240 && latinWords >= 25 && han < 5
  })
}

/** 找出仍是完整英文句子的标题，常见于漏译的面试题。 */
export function untranslatedHeadings(markdown) {
  const withoutFences = markdown.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '')
  return withoutFences.split('\n').filter((line) => {
    if (!/^#{1,6}\s/.test(line)) return false
    const latinWords = line.match(/\b[A-Za-z]{3,}\b/g)?.length ?? 0
    const han = line.match(/\p{Script=Han}/gu)?.length ?? 0
    return latinWords >= 6 && han < 2
  })
}

/** 比较不应因翻译改变的 Markdown 结构。 */
export function compareStructure(source, translation) {
  const issues = []
  const equal = (name, left, right) => {
    if (JSON.stringify(left) !== JSON.stringify(right)) issues.push(name)
  }
  equal('标题层级', headingShape(source), headingShape(translation))
  equal('非 Mermaid 代码块', codeBlocks(source), codeBlocks(translation))
  equal('Mermaid 结构', mermaidShape(source), mermaidShape(translation))
  equal('表格结构', tableShape(source), tableShape(translation))
  const translatedNumbers = numericTokens(translation)
  if (numericTokens(source).some((number) => !translatedNumbers.includes(number))) issues.push('数字')

  const sourceExternal = linkTargets(source).filter((target) => /^(?:https?:|mailto:)/.test(target)).sort()
  const translatedExternal = linkTargets(translation).filter((target) => /^(?:https?:|mailto:)/.test(target)).sort()
  equal('外部链接', sourceExternal, translatedExternal)
  return issues
}

/** 检查译文中的相对 Markdown 链接是否仍指向真实文件。 */
export function brokenRelativeLinks(markdown, file, root) {
  return linkTargets(markdown).filter((target) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(target)) return false
    let decoded
    try {
      decoded = decodeURIComponent(target)
    } catch {
      return true
    }
    const [rawPath, fragment] = decoded.split('#')
    const path = rawPath.split('?')[0]
    let resolved = normalize(join(root, dirname(file), path || file.split('/').pop()))
    if (path && !existsSync(resolved)) {
      if (existsSync(`${resolved}.md`)) resolved = `${resolved}.md`
      else if (existsSync(join(resolved, 'index.md'))) resolved = join(resolved, 'index.md')
      else return true
    }
    if (!fragment || !resolved.endsWith('.md') || !existsSync(resolved)) return false
    return !headingAnchors(readFileSync(resolved, 'utf8')).has(fragment)
  })
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** 列出状态表中存在、但工作树缺失的译文。 */
export function missingTranslations(files, root) {
  return files.filter((file) => !existsSync(join(root, file)))
}
