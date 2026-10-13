/** 解析 git diff --name-status -M，保留新增、修改、删除和重命名语义。 */
export function parseNameStatus(output, stateFiles = {}, currentBlobs = {}) {
  return output.split('\n').filter(Boolean).map((line) => {
    const [status, oldPath, renamedPath] = line.split('\t')
    const path = renamedPath ?? oldPath
    const metadata = stateFiles[oldPath]
    return {
      status,
      old_path: oldPath,
      path,
      community_edited: Boolean(metadata && currentBlobs[oldPath] && currentBlobs[oldPath] !== metadata.translation_blob),
    }
  })
}

/** 将 Git 祖先关系归一为同步状态；非快进历史必须停止。 */
export function classifyHistory(baseCommit, upstreamCommit, isAncestor) {
  if (!isAncestor) return { status: 'blocked', reason: 'upstream-non-fast-forward' }
  if (baseCommit === upstreamCommit) return { status: 'current' }
  return { status: 'updates-available' }
}

/** Parse a zero-context Git diff into exact deleted/added source lines per hunk. */
export function parseUnifiedDiff(output) {
  const hunks = []
  let current = null
  const finish = () => {
    if (current && (current.before.length || current.after.length)) hunks.push(current)
    current = null
  }

  for (const line of output.split('\n')) {
    const header = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
    if (header) {
      finish()
      current = {
        oldStart: Number(header[1]),
        oldCount: Number(header[2] ?? 1),
        newStart: Number(header[3]),
        newCount: Number(header[4] ?? 1),
        before: [],
        after: [],
      }
    } else if (current && line.startsWith('-') && !line.startsWith('---')) {
      current.before.push(line.slice(1))
    } else if (current && line.startsWith('+') && !line.startsWith('+++')) {
      current.after.push(line.slice(1))
    }
  }
  finish()
  return hunks
}

/** Map request-local hunk numbers back to stable file-wide IDs. */
export function mapPatchHunks(payload, hunks) {
  if (!Array.isArray(payload?.patches)) return payload
  return {
    ...payload,
    patches: payload.patches.map((patch) => {
      const map = (id) => Number.isInteger(id) && id >= 0 && id < hunks.length ? hunks[id].id ?? id : id
      if (Array.isArray(patch.hunks)) return { ...patch, hunks: patch.hunks.map(map) }
      return { ...patch, hunk: map(patch.hunk) }
    }),
  }
}

/** Find connected groups of patches that target overlapping translated text. */
export function overlappingPatchGroups(markdown, patches, scopes = {}) {
  const spans = patches.map((patch) => {
    const ids = Array.isArray(patch.hunks) ? patch.hunks : [patch.hunk]
    const bounds = ids.map((id) => scopes[id] ?? { start: 0, end: markdown.length })
    const start = Math.min(...bounds.map(({ start: value }) => value))
    const end = Math.max(...bounds.map(({ end: value }) => value))
    const space = markdown.slice(start, end)
    const find = findExactOrFenceVariant(space, patch.find)
    const offset = space.indexOf(find)
    if (!find || offset < 0 || space.indexOf(find, offset + 1) >= 0) return null
    return { ids, start: start + offset, end: start + offset + find.length }
  })
  const groups = []
  const used = new Set()
  spans.forEach((span, index) => {
    if (!span || used.has(index)) return
    const group = new Set([index])
    let changed = true
    while (changed) {
      changed = false
      for (let other = 0; other < spans.length; other += 1) {
        if (used.has(other) || group.has(other) || !spans[other]) continue
        if ([...group].some((member) => spans[member].start < spans[other].end && spans[other].start < spans[member].end)) {
          group.add(other)
          changed = true
        }
      }
    }
    if (group.size < 2) return
    for (const member of group) used.add(member)
    groups.push([...new Set([...group].flatMap((member) => spans[member].ids))])
  })
  return groups
}

/** Apply exact-text edits only when each target is unique within its hunk scope and non-overlapping. */
export function applyLocalizedPatches(markdown, patches, expectedHunks, scopes = {}) {
  const expectedHunkIds = Array.isArray(expectedHunks)
    ? expectedHunks
    : Array.from({ length: expectedHunks }, (_, index) => index)
  const expectedIds = new Set(expectedHunkIds)
  if (!Array.isArray(patches)) throw new Error('补丁未覆盖所有上游变更块（invalid）')
  const spans = patches.map((patch) => {
    if (typeof patch.find !== 'string' || !patch.find.trim() || typeof patch.replace !== 'string') {
      throw new Error(`hunk ${patch.hunk}: 缺少精确查找文本或替换文本`)
    }
    const hunkIds = Array.isArray(patch.hunks) ? patch.hunks : [patch.hunk]
    if (!hunkIds.length || hunkIds.some((id) => !Number.isInteger(id) || !expectedIds.has(id))) {
      throw new Error(`补丁引用了无效 hunk：${JSON.stringify({ hunkIds, expectedHunkIds })}`)
    }
    const bounds = hunkIds.map((id) => scopes[id] ?? { start: 0, end: markdown.length })
    const scope = { start: Math.min(...bounds.map(({ start }) => start)), end: Math.max(...bounds.map(({ end }) => end)) }
    let searchSpace = markdown.slice(scope.start, scope.end)
    let find = findExactOrFenceVariant(searchSpace, patch.find)
    let localStart = searchSpace.indexOf(find)
    if (localStart < 0 || searchSpace.indexOf(find, localStart + 1) >= 0) {
      const documentFind = findExactOrFenceVariant(markdown, patch.find)
      const documentStart = markdown.indexOf(documentFind)
      if (documentStart >= 0 && markdown.indexOf(documentFind, documentStart + 1) < 0) {
        searchSpace = markdown
        find = documentFind
        localStart = documentStart
      }
    }
    const start = localStart < 0 ? -1 : searchSpace === markdown ? localStart : scope.start + localStart
    if (start < 0 || searchSpace.indexOf(find, localStart + 1) >= 0) {
      throw new Error(`hunk ${patch.hunk}: 中文定位文本不存在或不唯一（${find.slice(0, 120)}）`)
    }
    const end = start + find.length
    return { ...patch, hunkIds, find, start, end }
  }).sort((left, right) => left.start - right.start)

  for (let index = 1; index < spans.length; index += 1) {
    if (spans[index - 1].end > spans[index].start) throw new Error('局部补丁范围重叠')
  }
  const hunkIds = new Set(spans.flatMap((span) => span.hunkIds))
  if (expectedHunkIds.some((hunk) => !hunkIds.has(hunk))) {
    throw new Error('补丁未覆盖所有上游变更块：未逐一覆盖唯一 hunk')
  }

  let result = markdown
  for (const span of spans.reverse()) {
    result = `${result.slice(0, span.start)}${span.replace}${result.slice(span.end)}`
  }
  return result
}

/** Return the preamble and heading-bounded ranges in document order. */
export function headingRanges(markdown) {
  const headings = []
  let offset = 0
  let fence = null
  for (const line of markdown.split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})(.*)$/)
    if (marker) {
      if (!fence) fence = { character: marker[1][0], length: marker[1].length }
      else if (marker[1][0] === fence.character && marker[1].length >= fence.length && !marker[2].trim()) fence = null
    } else if (!fence && /^#{1,6}\s/.test(line)) {
      headings.push(offset)
    }
    offset += line.length + 1
  }
  const boundaries = [0, ...headings, markdown.length]
  return boundaries.slice(0, -1).map((start, index) => ({ start, end: boundaries[index + 1] }))
}

/** Return question sections without treating headings inside code fences as boundaries. */
export function questionSections(markdown) {
  const headings = []
  let takeaways = markdown.length
  let offset = 0
  let fence = null
  for (const line of markdown.split('\n')) {
    const marker = line.match(/^\s*(`{3,}|~{3,})(.*)$/)
    if (marker) {
      if (!fence) fence = { character: marker[1][0], length: marker[1].length }
      else if (marker[1][0] === fence.character && marker[1].length >= fence.length && !marker[2].trim()) fence = null
    } else if (!fence && /^### Q(\d+):/.test(line)) {
      headings.push({ id: Number(line.match(/^### Q(\d+):/)[1]), start: offset })
    } else if (!fence && /^## (?:Key Takeaways|关键要点)$/.test(line)) {
      takeaways = Math.min(takeaways, offset)
    }
    offset += line.length + 1
  }
  return headings.map((heading, index) => {
    const end = Math.min(headings[index + 1]?.start ?? markdown.length, takeaways)
    return { ...heading, end, text: markdown.slice(heading.start, end).trimEnd() }
  })
}

/** Replace or insert complete question blocks before the document's top-level takeaways. */
export function upsertQuestionSections(markdown, sections, marker = '## 关键要点') {
  const additions = new Map()
  for (const section of sections) {
    const heading = section.match(/^### Q(\d+):/)
    if (!heading || additions.has(Number(heading[1]))) throw new Error('新增题目缺少唯一的 Q 编号')
    additions.set(Number(heading[1]), section.trim())
  }
  const existing = questionSections(markdown)
  const duplicates = new Set()
  for (const section of existing) {
    if (duplicates.has(section.id)) throw new Error(`译文含重复题号 Q${section.id}`)
    duplicates.add(section.id)
  }
  let result = markdown
  for (const section of existing.filter(({ id }) => additions.has(id)).reverse()) {
    const separator = markdown.slice(section.start + section.text.length, section.end)
    result = `${result.slice(0, section.start)}${additions.get(section.id)}${separator}${result.slice(section.end)}`
    additions.delete(section.id)
  }
  if (additions.size) {
    const markerOffset = result.indexOf(marker)
    if (markerOffset < 0 || result.indexOf(marker, markerOffset + marker.length) >= 0) {
      throw new Error(`找不到唯一的新增题目插入锚点：${marker}`)
    }
    const blocks = [...additions.entries()].sort(([left], [right]) => left - right).map(([, text]) => text)
    result = `${result.slice(0, markerOffset).trimEnd()}\n\n${blocks.join('\n\n')}\n\n${result.slice(markerOffset)}`
  }
  return result
}

/** Find every heading-bounded section touched by a Git hunk's source line span. */
export function headingSpan(markdown, startLine, lineCount) {
  const ranges = headingRanges(markdown)
  const lines = markdown.split('\n')
  const lineOffset = (lineNumber) => lines.slice(0, Math.max(0, lineNumber - 1))
    .reduce((offset, line) => offset + line.length + 1, 0)
  const sectionAt = (offset) => {
    const index = ranges.findIndex((range) => offset >= range.start && offset < range.end)
    return index >= 0 ? index : ranges.length - 1
  }
  const first = sectionAt(lineOffset(startLine))
  const lastLine = lineCount > 0 ? startLine + lineCount - 1 : startLine
  return { first, last: sectionAt(lineOffset(lastLine)) }
}

/** Include the prior section when a diff inserts new prose immediately before a changed heading. */
export function includePriorSectionForHeadingInsertion(span, hunk) {
  const heading = (line) => /^#{1,6}\s/.test(line)
  if (span.first > 0 && heading(hunk.before[0] ?? '') && !heading(hunk.after[0] ?? '') && hunk.after.some(heading)) {
    return { ...span, first: span.first - 1 }
  }
  return span
}

/** Check that an insertion preserves an anchor and inserts only at a blank-line boundary. */
export function preservesInsertionAnchor(find, replace) {
  if (replace === find) return true
  const listItem = /^\s*(?:[-*+]\s|\d+[.)]\s)/.test(find)
  const tableRow = /^\s*\|.*\|\s*$/.test(find)
  const insertion = replace.slice(find.length)
  const prefix = replace.slice(0, -find.length)
  const adjacentListItem = /^\n(?:[-*+]\s|\d+[.)]\s)/.test(insertion)
  const adjacentTableRow = /^\n\s*\|[^\n]*\|\s*(?:\n|$)/.test(insertion)
  const prependedTableRows = tableRow && replace.endsWith(find) && /^(?:\s*\|[^\n]*\|\s*\n)+$/.test(prefix)
  if (replace.startsWith(find) && (/^\n\n/.test(insertion) ||
      (listItem && adjacentListItem) || (tableRow && adjacentTableRow))) return true
  if (prependedTableRows) return true
  if (replace.endsWith(find) && /\n\n$/.test(replace.slice(0, -find.length))) return true
  const boundaries = [...find.matchAll(/\n\n/g)].map((match) => match.index + match[0].length)
  return boundaries.some((index) =>
    replace.length > find.length && replace.startsWith(find.slice(0, index)) && replace.endsWith(find.slice(index)),
  )
}

/** Restore a dropped list/table anchor when a model returned only the adjacent inserted row. */
export function restoreInsertionAnchor(find, replace) {
  if (replace.startsWith(find)) return replace
  const listItem = /^\s*(?:[-*+]\s|\d+[.)]\s)/.test(find) && /^\s*(?:[-*+]\s|\d+[.)]\s)/.test(replace)
  const tableRow = /^\s*\|.*\|\s*$/.test(find) && /^\s*\|.*\|\s*$/.test(replace)
  return listItem || tableRow ? `${find}\n${replace}` : replace
}

/** 旧译文省略围栏语言时，用去重后的完整代码块候选消除重复扫描造成的误报。 */
function findExactOrFenceVariant(markdown, target) {
  if (markdown.includes(target)) return target
  const opening = target.match(/^(`{3,}|~{3,})([^\n]*)\n/)
  if (!opening) return target
  const candidates = new Set()
  const pattern = /^(`{3,}|~{3,})([^\n]*)\n[\s\S]*?^\1\s*$/gm
  for (const match of markdown.matchAll(pattern)) {
    if (match[1][0] !== opening[1][0]) continue
    const actualHeader = `${match[1]}${match[2]}`
    const candidate = target.replace(opening[0], `${actualHeader}\n`)
    if (markdown.includes(candidate)) candidates.add(candidate)
  }
  return candidates.size === 1 ? candidates.values().next().value : target
}
