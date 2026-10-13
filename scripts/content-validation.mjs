import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'

const rControl = /[\u0000-\u001f]/g
const rSpecial = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g
const rCombining = /[\u0300-\u036F]/g

function withoutCodeFences(markdown) {
  let fence = null
  return markdown.split('\n').filter((line) => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (marker) {
      if (!fence) fence = { character: marker[1][0], length: marker[1].length }
      else if (marker[1][0] === fence.character && marker[1].length >= fence.length) fence = null
      return false
    }
    return !fence
  }).join('\n')
}

/** 与 VitePress 默认实现一致的标题 slug。 */
export function slugifyHeading(title) {
  return title.normalize('NFKD').replace(rCombining, '').replace(rControl, '').replace(rSpecial, '-')
    .replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').replace(/^(\d)/, '_$1').toLowerCase()
}

function headingAnchors(markdown) {
  const counts = new Map()
  const text = withoutCodeFences(markdown)
  const anchors = new Set([...text.matchAll(/<a\s+[^>]*id=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]))
  for (const line of text.split('\n').filter((candidate) => /^#{1,6}\s/.test(candidate))) {
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
    .map((match) => `${match[2].trim()}\n${match[3].replace(/[ \t]+$/gm, '')}`)
}

/** Check code content while ignoring line-end formatting spaces. */
export function preservesNonMermaidCodeBlocks(original, updated) {
  const originalBlocks = codeBlocks(original)
  return originalBlocks.length > 0 && JSON.stringify(originalBlocks) === JSON.stringify(codeBlocks(updated))
}

/** 只比较 Mermaid 的拓扑标记与声明数量，允许节点可见标签翻译。 */
export function mermaidShape(markdown) {
  return [...markdown.matchAll(/^(`{3,}|~{3,})mermaid\s*\n([\s\S]*?)^\1\s*$/gm)].map((match) => {
    const diagram = match[2]
    const syntax = diagram.replace(/"[^"\n]*"/g, '""')
    return {
      arrows: [...syntax.matchAll(/-->>|-.->|==>|->>|--x|--\)|-->|---/g)].map((item) => item[0]).sort(),
      square: [...syntax.matchAll(/\b[\w-]+\s*\[/g)].length,
      round: [...syntax.matchAll(/\b[\w-]+\s*\(/g)].length,
      curly: [...syntax.matchAll(/\b[\w-]+\s*\{/g)].length,
      declarations: [...syntax.matchAll(/^\s*(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|journey|pie|mindmap|timeline|participant|actor|class|state|subgraph)\b/gm)].length,
    }
  })
}

export function headingShape(markdown) {
  const headings = []
  let fence = null
  for (const line of markdown.split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})(.*)$/)
    if (marker) {
      if (!fence) fence = { character: marker[1][0], length: marker[1].length }
      else if (marker[1][0] === fence.character && marker[1].length >= fence.length && !marker[2].trim()) fence = null
    } else if (!fence && /^#{1,6}\s/.test(line)) {
      headings.push(line.match(/^#+/)[0].length)
    }
  }
  return headings
}

export function numericTokens(markdown) {
  const scale = {
    k: 1_000, thousand: 1_000, m: 1_000_000, million: 1_000_000,
    b: 1_000_000_000, billion: 1_000_000_000, t: 1_000_000_000_000, trillion: 1_000_000_000_000, '%': 1, percent: 1,
    万: 10_000, 亿: 100_000_000, 万亿: 1_000_000_000_000,
    百万: 1_000_000, 千万: 10_000_000, 十亿: 1_000_000_000, 百亿: 10_000_000_000,
  }
  const pattern = /(?<![A-Za-z_])(\d+(?:[.,]\d+)*)(?:(万亿|百万|千万|十亿|百亿|[KMBT%万亿])(?![A-Za-z])|\s+(thousand|million|billion|trillion|percent|万亿|百万|千万|十亿|百亿|万|亿|%)(?![A-Za-z]))?/giu
  let prose = withoutCodeFences(markdown)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\b(january|february|march|april|june|july|august|september|october|november|december)\b/gi, (month) => String(['january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].indexOf(month.toLowerCase()) + 1 + (['january', 'february', 'march', 'april'].includes(month.toLowerCase()) ? 0 : 1)))
    .replace(/\bmay\s+(\d{1,2})\b/gi, '5 $1')
  const versions = [...prose.matchAll(/(?<![A-Za-z])v?\d+(?:\.\d+){2,}/g)].map((match) => match[0].replace(/^v/, ''))
  prose = prose.replace(/(?<![A-Za-z])v?\d+(?:\.\d+){2,}/g, ' ')
  prose = prose
    .replace(/(!?)\[([^\]]*)\]\(([^)]+)\)/g, '$2')
    .replace(/https?:\/\/[^\s)]+/g, '')
    .replace(/(\d{1,3})\s*\/\s*(\d{1,3})\s+split\b/gi, '$1% $2%')
    .replace(/(\d+(?:\.\d+)?)\s*百分(?:比|之)/g, '$1%')
    .replace(/百分之\s*(\d+(?:\.\d+)?)/g, '$1%')
    .replace(/(\d+(?:[.,]\d+)*)\s*(?:[-–—]|\bto\b|至|到)\s*(\d+(?:[.,]\d+)*)\s*(%|percent\b)/gi, (match, start, end, _unit, offset, text) => {
      const context = text.slice(Math.max(0, offset - 18), offset)
      const year = /^(?:19|20)\d{2}$/.test(start)
      const ambiguousDecimal = start.includes('.') && /\bto\b/i.test(match) && !/(?:from|between)\s*$/i.test(context)
      return year || ambiguousDecimal ? match : `${start}%–${end}%`
    })
  const values = [...prose.matchAll(pattern)].map((match) => {
    const unitName = match[2] ?? match[3]
    const unit = BigInt(scale[unitName?.toLowerCase()] ?? 1)
    const [integer, fraction = ''] = match[1].replaceAll(',', '').split('.')
    const numerator = BigInt(`${integer}${fraction}`) * unit
    const denominator = 10n ** BigInt(fraction.length) * (['%', 'percent'].includes(unitName?.toLowerCase()) ? 100n : 1n)
    const whole = numerator / denominator
    const remainder = numerator % denominator
    const decimal = remainder ? `.${remainder.toString().padStart(fraction.length, '0').replace(/0+$/, '')}` : ''
    return `${whole}${decimal}`
  })
  for (const [unit, value] of [['千', '1000'], ['百万', '1000000'], ['千万', '10000000'], ['十亿', '1000000000'], ['百亿', '10000000000']]) {
    const followedByCount = unit === '千' && /千(?=页|次|条|个|段|令牌|任务|行|项|名|张|座|台|家|月|年|小时|秒|毫秒|天|用户|租户)/u.test(prose)
    const hasNumericPrefix = new RegExp(`\\d[\\d.,]*\\s?${unit}`, 'u').test(prose)
    if (followedByCount || (!hasNumericPrefix && new RegExp(`(?<!\\d)${unit}(?![\\p{Script=Han}])`, 'u').test(prose))) values.push(value)
  }
  return [...new Set([...values, ...versions])].sort()
}

export function linkTargets(markdown) {
  return [...withoutCodeFences(markdown).matchAll(/!?(?:\[[^\]]*\])\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map((match) => match[1])
}

export function tableShape(markdown) {
  let fence = null
  return markdown.split('\n').filter((line) => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (marker) {
      if (!fence) fence = { character: marker[1][0], length: marker[1].length }
      else if (marker[1][0] === fence.character && marker[1].length >= fence.length) fence = null
      return false
    }
    return !fence && /^\s*\|.*\|\s*$/.test(line)
  }).map((line) => {
    let pipes = 0
    let ticks = 0
    let escaped = false
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index]
      if (character === '\\' && !escaped) { escaped = true; continue }
      if (character === '`' && !escaped) {
        const run = line.slice(index).match(/^`+/)[0].length
        ticks = ticks === run ? 0 : ticks || run
        index += run - 1
      } else if (character === '|' && !escaped && !ticks) pipes += 1
      escaped = false
    }
    return pipes
  })
}

/** 找出疑似整段漏译的英文正文；代码、HTML、表格和参考条目不参与。 */
export function untranslatedBlocks(markdown) {
  const withoutFences = withoutCodeFences(markdown)
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
  const withoutFences = withoutCodeFences(markdown)
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

  const sourceExternal = [...new Set(linkTargets(source).filter((target) => /^(?:https?:|mailto:)/.test(target)))].sort()
  const translatedExternal = [...new Set(linkTargets(translation).filter((target) => /^(?:https?:|mailto:)/.test(target)))].sort()
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
