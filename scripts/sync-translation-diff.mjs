#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { applyLocalizedPatches, headingRanges, headingSpan, includePriorSectionForHeadingInsertion, mapPatchHunks, overlappingPatchGroups, parseNameStatus, parseUnifiedDiff, preservesInsertionAnchor, questionSections, restoreInsertionAnchor, upsertQuestionSections } from './sync-planning.mjs'
import { codeBlocks, compareStructure, headingShape, linkTargets, numericTokens, preservesNonMermaidCodeBlocks, readJson, slugifyHeading } from './content-validation.mjs'

const args = process.argv.slice(2)
const review = args.includes('--review')
const dryRun = args.includes('--dry-run')
const fileIndex = args.indexOf('--file')
const selectedFile = fileIndex >= 0 ? args[fileIndex + 1] : null
const state = readJson('translation-state.json')
const upstreamRef = args.find((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--file') ?? 'upstream/main'
const model = 'gpt-5.6-terra'

/** Run a Git command and return trimmed text. */
function git(...gitArgs) {
  const result = spawnSync('git', gitArgs, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  if (result.status !== 0) throw new Error(`Git 命令失败：${gitArgs.join(' ')}\n${result.stderr.trim()}`)
  return result.stdout.trim()
}

/** Read an upstream Markdown file directly from its immutable commit. */
function gitFile(commit, path) {
  const result = spawnSync('git', ['show', `${commit}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(result.stderr.trim())
  return result.stdout
}

/** Invoke a fresh, read-only Codex CLI context and cache its structured response. */
function runCodex(prompt, input) {
  const cacheRoot = resolve('.translation-cache', review ? 'sync-review' : 'sync-translate')
  mkdirSync(cacheRoot, { recursive: true })
  const key = createHash('sha256').update(`${model}\0${prompt}\0${input}`).digest('hex')
  const outputPath = join(cacheRoot, `${key}.json`)
  if (!existsSync(outputPath)) {
    const run = (selectedModel) => spawnSync('codex', [
      'exec', '-m', selectedModel, '-c', "model_reasoning_effort='low'",
      '-s', 'read-only', '-C', tmpdir(), '--skip-git-repo-check',
      '--ignore-user-config', '--disable', 'image_generation', '--ephemeral',
      '-o', outputPath, prompt,
    ], { input, encoding: 'utf8', stdio: ['pipe', 'ignore', 'pipe'], maxBuffer: 4 * 1024 * 1024 })
    let result = run(model)
    if (result.status !== 0 && result.stderr?.includes('Selected model is at capacity')) result = run('gpt-6.1-sol')
    if (result.status !== 0 || !existsSync(outputPath)) {
      if (existsSync(outputPath)) unlinkSync(outputPath)
      throw new Error(`独立 Codex 上下文失败（${result.status}）：${result.stderr?.trim().slice(-1200) ?? '未生成审校产物'}`)
    }
  }
  const output = readFileSync(outputPath, 'utf8').trim()
  const start = output.indexOf('{')
  if (start >= 0) {
    let depth = 0
    let inString = false
    let escaped = false
    for (let index = start; index < output.length; index += 1) {
      const character = output[index]
      if (inString) {
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
        else if (character === '"') inString = false
      } else if (character === '"') inString = true
      else if (character === '{') depth += 1
      else if (character === '}') {
        depth -= 1
        if (depth === 0) {
          try {
            return JSON.parse(output.slice(start, index + 1))
          } catch (error) {
            writeFileSync(`${outputPath}.invalid`, output)
            throw new Error(`Codex JSON 解析失败：${error.message}；原始输出保存在 ${outputPath}.invalid`)
          }
        }
      }
    }
  }
  writeFileSync(`${outputPath}.invalid`, output)
  throw new Error(`Codex 未返回完整 JSON；原始输出保存在 ${outputPath}.invalid`)
}

/** Require one exact patch per source hunk and verify the returned hunk text. */
function validatePatches(payload, hunks) {
  if (process.env.SYNC_DEBUG_PATCHES) console.error(JSON.stringify(payload?.patches?.map(({ hunk, find, replace }) => ({ hunk, find: find.slice(0, 80), replace: replace.slice(0, 120) }))))
  const patches = payload?.patches
  const ids = hunks.map((hunk, index) => hunk.id ?? index)
  if (!Array.isArray(patches)) {
    throw new Error(`返回局部补丁无效（${payload?.patches?.length ?? 'invalid'}）`)
  }
  const represented = new Set()
  for (const patch of patches) {
    const localIndex = ids.indexOf(patch.hunk)
    if (localIndex < 0) {
      throw new Error(`Codex 补丁引用了无效上游 hunk ${patch.hunk}；当前有效编号：${ids.join(', ')}`)
    }
    represented.add(patch.hunk)
    if (!review && hunks[localIndex].before.length === 0 && !/^(?:`{3,}|~{3,})/.test(patch.find) && (!preservesInsertionAnchor(patch.find, patch.replace) || patch.replace === patch.find)) {
      throw new Error(`新增 hunk ${patch.hunk} 未原样保留中文插入锚点：${JSON.stringify({ find: patch.find.slice(0, 100), replace: patch.replace.slice(0, 150), hunk_patches: payload.patches.filter((item) => item.hunk === patch.hunk).map((item) => ({ find: item.find.slice(0, 100), replace: item.replace.slice(0, 150) })) })}`)
    }
  }
  if (ids.some((index) => !represented.has(index))) {
    throw new Error(`Codex 未为每个 Git hunk 返回至少一个中文局部补丁（缺少 ${ids.filter((index) => !represented.has(index)).join(', ')}）`)
  }
  return patches
}

/** Remove code-block patches only after they have satisfied source-hunk coverage. */
function removeCodeBlockPatches(payload, markdown) {
  if (!Array.isArray(payload?.patches)) return payload
  const ranges = [...markdown.matchAll(/^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1\s*$/gm)]
    .filter((match) => match[2].trim() !== 'mermaid')
    .map((match) => ({ start: match.index, end: match.index + match[0].length }))
  return {
    ...payload,
    patches: payload.patches.filter((patch) => {
      if (patch.find !== patch.replace && preservesNonMermaidCodeBlocks(patch.find, patch.replace)) return true
      if (/^(?:`{3,}|~{3,})(?!mermaid\b)/i.test(patch.find)) return false
      const matches = [...markdown.matchAll(new RegExp(patch.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))]
      if (matches.length !== 1) return true
      const start = matches[0].index
      return !ranges.some((range) => start >= range.start && start + patch.find.length <= range.end)
    }),
  }
}

/** Fold dependent same-hunk edits into one original-document replacement. */
function combineDependentPatches(patches, markdown) {
  const combined = []
  for (const patch of patches) {
    const duplicate = combined.find((candidate) => candidate.hunk === patch.hunk && candidate.find === patch.find)
    if (duplicate) {
      if (patch.replace.length > duplicate.replace.length) duplicate.replace = patch.replace
      continue
    }
    const parent = combined.find((candidate) => candidate.hunk === patch.hunk &&
      !markdown.includes(patch.find) && candidate.replace.includes(patch.find))
    if (parent) parent.replace = parent.replace.replace(patch.find, patch.replace)
    else combined.push({ ...patch })
  }
  return combined
}

/** Restore a translated section whose source heading moved after its example block. */
function moveSectionBefore(markdown, heading, targetHeading) {
  const start = markdown.indexOf(heading)
  const target = markdown.indexOf(targetHeading)
  if (start < 0 || target < 0 || start > target) throw new Error(`无法定位要移动的章节：${heading}`)
  const nextHeading = markdown.slice(start + heading.length).search(/^#{1,6}\s/m)
  if (nextHeading < 0) throw new Error(`移动章节缺少后续边界：${heading}`)
  const end = start + heading.length + nextHeading
  const section = markdown.slice(start, end).trim()
  const withoutSection = `${markdown.slice(0, start)}${markdown.slice(end)}`
  const insertAt = withoutSection.indexOf(targetHeading)
  return `${withoutSection.slice(0, insertAt)}${section}\n\n${withoutSection.slice(insertAt)}`
}

/** Move ColBERT out of the superseded quantization section into its new parent. */
function repairEmbeddingSectionOrder(markdown) {
  const quantization = '## 规模化量化'
  const lateInteraction = '### Late Interaction（ColBERT）'
  const first = markdown.indexOf(quantization)
  const second = markdown.indexOf(quantization, first + quantization.length)
  const interaction = markdown.indexOf(lateInteraction, first + quantization.length)
  if (first < 0 || second < 0 || interaction < 0 || interaction > second) return markdown
  return `${markdown.slice(0, first)}${markdown.slice(interaction)}`
}

/** Preserve the existing row when a model returned only a new adjacent list/table item. */
function restoreInsertionPatches(payload, hunks) {
  if (!Array.isArray(payload?.patches)) return payload
  return {
    ...payload,
    patches: payload.patches.map((patch) => {
      const hunk = hunks.find(({ id }) => id === patch.hunk)
      if (!hunk || hunk.before.length) return patch
      return { ...patch, replace: restoreInsertionAnchor(patch.find, patch.replace) }
    }),
  }
}

/** Return source hunks omitted or invalidly anchored by the first pass. */
function incompleteHunkIds(payload, hunks, reviewPass, contexts) {
  const patches = Array.isArray(payload?.patches) ? payload.patches : []
  const expected = hunks.map((hunk, index) => hunk.id ?? index)
  if (patches.some((patch) => !expected.includes(patch.hunk))) return expected
  const ids = new Set(patches.map((patch) => patch.hunk))
  return hunks.flatMap((hunk, index) => {
    const id = expected[index]
    const unanchoredInsertion = !reviewPass && hunk.before.length === 0 && patches.some((patch) => {
      if (patch.hunk !== id || /^(?:`{3,}|~{3,})/.test(patch.find)) return false
      const related = contexts.filter((context) => !context.source_hunks || context.source_hunks.includes(id))
      const anchorInContext = related.some((context) => context.current_chinese.includes(patch.find))
      return !anchorInContext || !preservesInsertionAnchor(patch.find, patch.replace) || patch.replace === patch.find
    })
    return ids.has(id) && !unanchoredInsertion ? [] : [id]
  })
}

/** Return a hunk's exact heading-bounded span without neighboring sections. */
function headingSection(markdown, span) {
  const ranges = headingRanges(markdown)
  const first = ranges[span.first]
  const last = ranges[span.last]
  if (!first || !last) throw new Error('三方文档的章节索引越界')
  return markdown.slice(first.start, last.end)
}

/** Remove appended questions while keeping the existing translated document available for localized hunks. */
function withoutQuestionSections(markdown, ids) {
  const selected = new Set(ids)
  let result = markdown
  for (const section of questionSections(markdown).filter(({ id }) => selected.has(id)).reverse()) {
    result = `${result.slice(0, section.start)}${result.slice(section.end)}`
  }
  return result
}

/** Translate new non-question headings and insert them before the related new question. */
function translateAddedHeadings(path, oldSource, newSource, existingTranslation, addedQuestions) {
  const headingLines = (markdown) => {
    const result = []
    let offset = 0
    let fence = null
    for (const line of markdown.split('\n')) {
      const marker = line.match(/^\s*(`{3,}|~{3,})(.*)$/)
      if (marker) {
        if (!fence) fence = { character: marker[1][0], length: marker[1].length }
        else if (marker[1][0] === fence.character && marker[1].length >= fence.length && !marker[2].trim()) fence = null
      } else if (!fence && /^#{1,6}\s/.test(line)) result.push({ text: line, offset })
      offset += line.length + 1
    }
    return result
  }
  const prior = new Set(headingLines(oldSource).map(({ text }) => text))
  const additions = headingLines(newSource).filter(({ text, offset }) =>
    !prior.has(text) && !/^### Q\d+:/.test(text) && !addedQuestions.some((question) => offset >= question.start && offset < question.end),
  ).map(({ text, offset }) => ({ text, question_id: addedQuestions.find((question) => question.start > offset)?.id }))
  return additions.map((heading) => {
    if (!heading.question_id) throw new Error(`${path}: 新增标题无法映射到后续新增题目`)
    const currentHeading = headingBeforeQuestion(existingTranslation, heading.question_id)
    if (review && !currentHeading) throw new Error(`${path}: 二遍校对找不到新增标题 ${heading.text}`)
    if (!review && currentHeading) return { question_id: heading.question_id, current: currentHeading, text: currentHeading }
    const prompt = review
      ? '你是独立第二遍语义校对员。核对新增标题的含义，保留中文自然表达并修正专有名词。只输出 JSON：{"translation":"..."}。'
      : '将新增 Markdown 标题翻译成中文，只输出 JSON：{"translation":"..."}。'
    const payload = runCodex(prompt, JSON.stringify({ path, new_english_heading: heading.text, current_chinese_heading: currentHeading }))
    const translated = payload.translation?.trim()
    if (!translated || !/^#{1,6}\s/.test(translated) || headingShape(heading.text)[0] !== headingShape(translated)[0]) {
      throw new Error(`${path}: 新增标题翻译无效：${heading.text}`)
    }
    const sourceTitle = heading.text.replace(/^#{1,6}\s+/, '')
    const translatedTitle = translated.replace(/^#{1,6}\s+/, '')
    const anchor = slugifyHeading(sourceTitle)
    const prefix = linkTargets(newSource).includes(`#${anchor}`) && slugifyHeading(translatedTitle) !== anchor
      ? `<a id="${anchor}"></a>\n`
      : ''
    return { question_id: heading.question_id, current: currentHeading, text: `${prefix}${translated}` }
  })
}

/** Find the standalone heading immediately before a question block. */
function headingBeforeQuestion(markdown, id) {
  const question = questionSections(markdown).find((section) => section.id === id)
  if (!question) return null
  const before = markdown.slice(0, question.start).split('\n').reverse()
  return before.find((line) => line.trim())?.match(/^##\s/) ? before.find((line) => line.trim()) : null
}

/** Remove added parent headings before ordinary old-section patches are scoped. */
function withoutAddedHeadings(markdown, headings) {
  let result = markdown
  for (const heading of headings.filter(({ current }) => current).reverse()) {
    result = result.replace(`${heading.current}\n`, '')
  }
  return result
}

/** Apply translated parent headings while retaining the source anchor used by new links. */
function upsertQuestionHeadings(markdown, headings) {
  let result = markdown
  for (const heading of headings) {
    const question = questionSections(result).find((section) => section.id === heading.question_id)
    if (!question) throw new Error(`找不到新增标题的题目锚点 Q${heading.question_id}`)
    if (heading.current) result = result.replace(`${heading.current}\n`, '')
    const currentQuestion = questionSections(result).find((section) => section.id === heading.question_id)
    const prefix = result.slice(0, currentQuestion.start).replace(/\n*$/, '\n\n')
    result = `${prefix}${heading.text}\n\n${result.slice(currentQuestion.start)}`
  }
  return result
}

/** Translate added source lines containing new links, preserving every target byte-for-byte. */
function translateAddedLinkedLines(path, oldSource, newSource, existingTranslation, markdown) {
  const oldTargets = new Set(linkTargets(oldSource))
  const additions = []
  const sourceLines = newSource.split('\n')
  const keyTakeaways = sourceLines.findIndex((line) => /^## Key Takeaways$/.test(line))
  const references = sourceLines.findIndex((line) => /^## References$/.test(line))
  const voiceSources = sourceLines.findIndex((line) => /^\*\*Voice and September 2026 sources\*\*/.test(line))
  sourceLines.forEach((line, index) => {
    const targets = linkTargets(line).filter((target) => !oldTargets.has(target))
    if (!targets.length) return
    additions.push({ line, targets, placement: index < keyTakeaways ? 'takeaways' : 'references' })
  })
  if (voiceSources >= 0 && !oldSource.includes('Voice and September 2026 sources')) {
    additions.push({ line: sourceLines[voiceSources], targets: linkTargets(sourceLines[voiceSources]), placement: 'references', source_order: voiceSources })
  }
  additions.sort((left, right) => (left.source_order ?? sourceLines.indexOf(left.line)) - (right.source_order ?? sourceLines.indexOf(right.line)))
  if (!additions.length) return markdown
  const prompt = review
    ? '你是独立第二遍语义校对员。逐行核对英文新增内容与中文，重点检查遗漏、反义、数字、价格、安全、法规和专有名词。只输出 JSON：{"lines":["..."]}，行数和输入完全相同。'
    : '翻译新增 Markdown 行。只翻译可见文字，逐字保留所有 URL、相对锚点、代码和数字；每个输入行对应一个完整中文行。只输出 JSON：{"lines":["..."]}，行数和输入完全相同。'
  const sourceLinesToTranslate = additions.map(({ line }) => line)
  const currentLines = additions.map(({ line, targets }) => {
    const found = existingTranslation.split('\n').filter((candidate) =>
      targets.length ? targets.some((target) => linkTargets(candidate).includes(target)) : candidate.startsWith('**') && /语音|来源/.test(candidate),
    )
    return found.length === 1 ? found[0] : ''
  })
  if (!review && currentLines.every((line, index) => line && JSON.stringify(linkTargets(line)) === JSON.stringify(additions[index].targets))) return markdown
  const payload = runCodex(prompt, JSON.stringify({ path, new_english_lines: sourceLinesToTranslate, current_chinese_lines: currentLines }))
  if (!Array.isArray(payload.lines) || payload.lines.length !== additions.length) throw new Error(`${path}: 新增链接行翻译数量不符`)
  for (let index = 0; index < additions.length; index += 1) {
    const targets = linkTargets(payload.lines[index])
    if (JSON.stringify(targets) !== JSON.stringify(additions[index].targets)) throw new Error(`${path}: 新增行的 URL 或锚点发生变化（${JSON.stringify(additions[index].targets)} -> ${JSON.stringify(targets)}）：${additions[index].line}；译文：${payload.lines[index]}`)
  }
  let result = markdown
  const replacements = new Map()
  for (let index = 0; index < additions.length; index += 1) {
    const current = currentLines[index]
    if (current) replacements.set(current, payload.lines[index])
  }
  for (const [current, translated] of replacements) result = result.replace(current, translated)
  const takeaways = payload.lines.filter((_, index) => additions[index].placement === 'takeaways' && !currentLines[index])
  if (takeaways.length) {
    const marker = '\n## 关键要点'
    const offset = result.indexOf(marker)
    if (offset < 0 || result.indexOf(marker, offset + marker.length) >= 0) throw new Error(`${path}: 新增面试提示缺少唯一插入锚点`)
    result = `${result.slice(0, offset).trimEnd()}\n\n${takeaways.join('\n')}\n${result.slice(offset)}`
  }
  const refs = payload.lines.filter((_, index) => additions[index].placement === 'references' && !currentLines[index])
  if (refs.length) {
    const footer = '\n---\n\n*另见：'
    const offset = result.lastIndexOf(footer)
    if (offset < 0) throw new Error(`${path}: 新增参考资料缺少唯一插入锚点`)
    result = `${result.slice(0, offset).trimEnd()}\n\n${refs.join('\n')}\n${result.slice(offset)}`
  }
  return result
}

/** Copy non-Mermaid code blocks byte-for-byte from source after checking one-to-one ordering. */
function alignNonMermaidFenceInfo(source, translation) {
  const fences = (markdown) => [...markdown.matchAll(/^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1\s*$/gm)]
    .filter((match) => match[2].trim() !== 'mermaid')
  const sourceFences = fences(source)
  const translatedFences = fences(translation)
  if (sourceFences.length !== translatedFences.length) throw new Error('非 Mermaid 代码块数量不同')
  let result = translation
  for (let index = sourceFences.length - 1; index >= 0; index -= 1) {
    const sourceFence = sourceFences[index]
    const translatedFence = translatedFences[index]
    const start = translatedFence.index
    const end = start + translatedFence[0].length
    result = `${result.slice(0, start)}${sourceFence[0]}${result.slice(end)}`
  }
  return result
}

/** Detect hunks fully contained in a non-Mermaid fence; the exact source block is copied later. */
function hunkIsNonMermaidCodeOnly(markdown, hunk, side) {
  const start = hunk[`${side}Start`]
  const count = hunk[`${side}Count`]
  if (!count) return false
  const ranges = [...markdown.matchAll(/^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1\s*$/gm)]
    .filter((match) => match[2].trim() !== 'mermaid')
    .map((match) => {
      const first = markdown.slice(0, match.index).split('\n').length
      return { first, last: first + match[0].split('\n').length - 1 }
    })
  return ranges.some((range) => start >= range.first && start + count - 1 <= range.last)
}

/** Repair changed source lines when the first patch pass left a required number out. */
function repairMissingNumericLines(path, oldSource, newSource, markdown, hunks) {
  const translatedNumbers = new Set(numericTokens(markdown))
  const missing = numericTokens(newSource).filter((number) => !translatedNumbers.has(number))
  if (!missing.length) return markdown
  const addedQuestionLine = questionSections(newSource).find(({ id }) => !questionSections(oldSource).some((section) => section.id === id))
  const sourceLines = newSource.split('\n')
  const oldRanges = headingRanges(oldSource)
  const currentRanges = headingRanges(markdown)
  const groups = []
  for (const hunk of hunks) {
    for (const line of hunk.after.filter((candidate) => numericTokens(candidate).some((number) => missing.includes(number)))) {
      const lineIndex = sourceLines.indexOf(line)
      if (lineIndex < 0 || (addedQuestionLine && lineIndex + 1 >= newSource.slice(0, addedQuestionLine.start).split('\n').length)) continue
      const span = headingSpan(newSource, lineIndex + 1, 1)
      if (span.first !== span.last || !oldRanges[span.first] || !currentRanges[span.first]) continue
      const entry = groups.find(({ section }) => section === span.first)
      if (entry) entry.lines.push(line)
      else groups.push({ section: span.first, hunk: groups.length, lines: [line] })
    }
  }
  if (!groups.length) throw new Error(`${path}: 缺失数字无法映射到新增上游文本：${missing.join(', ')}`)
  const contexts = groups.map(({ section, hunk, lines }) => {
    const sourceRange = oldRanges[section]
    const range = currentRanges[section]
    return {
      hunk,
      old_english: oldSource.slice(sourceRange.start, sourceRange.end),
      current_chinese: markdown.slice(range.start, range.end),
      changed_english_lines: lines,
    }
  })
  const prompt = `${review ? '独立二遍校对遗漏的数字及语义' : '翻译器补齐遗漏的上游数字及对应内容'}。只修改确实受影响的中文块，保留其他社区译文。代码、命令、URL和非 Mermaid 代码块不变。输出且只输出 JSON：{"patches":[{"hunk":0,"find":"当前中文中唯一完整文本","replace":"更新后的中文文本"}]}。必须使用输入 hunk 编号，逐一覆盖所有 changed_english_lines 中的数字。`
  const payload = runCodex(prompt, JSON.stringify({ path, missing_numbers: missing, contexts }))
  if (!Array.isArray(payload.patches) || groups.some(({ hunk }) => !payload.patches.some((patch) => patch.hunk === hunk))) {
    throw new Error(`${path}: 数字遗漏修复未覆盖所有相关 hunk（期望 ${groups.map(({ hunk }) => hunk)}，收到 ${payload.patches?.map(({ hunk }) => hunk)}）`)
  }
  const scopes = Object.fromEntries(groups.map(({ section, hunk }) => [hunk, currentRanges[section]]))
  const patches = combineDependentPatches(payload.patches, markdown)
  for (let index = 0; index < patches.length; index += 1) {
    for (let other = index + 1; other < patches.length;) {
      const left = patches[index]
      const right = patches[other]
      if (left.find !== right.find) { other += 1; continue }
      const suffix = right.replace.startsWith(right.find) ? right.replace.slice(right.find.length) : null
      if (suffix === null || !left.replace.startsWith(left.find)) { other += 1; continue }
      left.replace += suffix
      left.hunks = [...new Set([...(left.hunks ?? [left.hunk]), ...(right.hunks ?? [right.hunk])])]
      patches.splice(other, 1)
    }
  }
  if (process.env.SYNC_DEBUG_PATCHES) console.error(JSON.stringify({ numeric_patches: patches.map(({ hunk, find, replace }) => ({ hunk, find, replace })) }))
  return applyLocalizedPatches(markdown, patches, groups.map(({ hunk }) => hunk), scopes)
}

/** Remove obsolete or duplicate external links while preserving links still present upstream. */
function removeSurplusExternalLinks(source, markdown) {
  const counts = (text) => linkTargets(text).filter((target) => /^(?:https?:|mailto:)/.test(target))
    .reduce((result, target) => result.set(target, (result.get(target) ?? 0) + 1), new Map())
  const expected = counts(source)
  const actual = counts(markdown)
  let result = markdown
  for (const [target, count] of actual) {
    let surplus = count - (expected.get(target) ?? 0)
    while (surplus > 0) {
      const lines = result.split('\n')
      const index = lines.findLastIndex((line) => line.includes(`](${target})`))
      if (index < 0) throw new Error(`无法定位多余外链：${target}`)
      const lineTargets = linkTargets(lines[index]).filter((url) => /^(?:https?:|mailto:)/.test(url))
      if (lineTargets.length === 1 && /^\s*[-*+]\s/.test(lines[index])) lines.splice(index, 1)
      else lines[index] = lines[index].replace(new RegExp(`\\[[^\\]]*\\]\\(${target.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\)`), '')
      result = lines.join('\n')
      surplus -= 1
    }
  }
  return result
}

/** Translate or independently review each complete question added by the upstream commit. */
function translateAddedQuestions(path, sourceSections, existingTranslation) {
  return sourceSections.map(({ id, text: source }) => {
    const current = questionSections(existingTranslation).find((section) => section.id === id)?.text
    if (review && !current) throw new Error(`${path}: 二遍校对找不到 Q${id} 的首译全文`)
    const instruction = review
      ? '你是独立第二遍语义校对员。对照英文逐句核对完整中文题目，重点检查遗漏、反义、数字、价格、安全、法规与专有名词。保留正确译文，只修复问题。'
      : '将新增的完整英文面试题翻译成中文。不得遗漏任何段落、列表项或追问。保留题号、代码、命令、URL、链接目标、数字、非 Mermaid 代码块；Mermaid 只翻译标签且拓扑不变。'
    const prompt = `${instruction}\n输出且只输出 JSON：{"translation":"完整 Markdown 中文译文"}。译文必须以 ### Q${id}: 开头。`
    const input = JSON.stringify(review
      ? { path, question_id: id, new_english: source, first_pass_chinese: current }
      : { path, question_id: id, new_english: source })
    const payload = runCodex(prompt, input)
    if (typeof payload.translation !== 'string' || !payload.translation.trim().startsWith(`### Q${id}:`)) {
      throw new Error(`${path}: Codex 未返回 Q${id} 的完整题目译文`)
    }
    const issues = compareStructure(source, payload.translation)
    if (issues.length) throw new Error(`${path}: Q${id} 结构或不变量校验失败：${issues.join('、')}`)
    return payload.translation.trim()
  })
}

function standaloneQuestionSections(markdown) {
  const ranges = headingRanges(markdown)
  return ranges.flatMap((range, index) => {
    const text = markdown.slice(range.start, range.end).trimEnd()
    const heading = text.split('\n', 1)[0]
    return /^### Q:\s/.test(heading) ? [{ heading, text, start: range.start, end: range.end, next: ranges[index + 1] }] : []
  })
}

function translateStandaloneQuestions(path, sections) {
  return sections.map((section) => {
    const prompt = '将新增的完整英文问答翻译成中文。不得遗漏段落、列表项或追问；保留数字、专有名词、URL 和结构。标题必须以 ### Q: 开头。输出且只输出 JSON：{"translation":"完整 Markdown 中文译文"}。'
    const payload = runCodex(prompt, JSON.stringify({ path, new_english: section.text }))
    if (typeof payload.translation !== 'string' || !payload.translation.trim().startsWith('### Q:')) {
      throw new Error(`${path}: Codex 未返回完整的新增 Q 问答译文`)
    }
    const issues = compareStructure(section.text, payload.translation)
    if (issues.length) throw new Error(`${path}: 新增 Q 问答结构或不变量校验失败：${issues.join('、')}`)
    return { ...section, translation: payload.translation.trim() }
  })
}

function insertStandaloneQuestions(markdown, oldSource, newSource, sections) {
  if (!sections.length) return markdown
  const oldRanges = headingRanges(oldSource)
  const translatedRanges = headingRanges(markdown)
  const inserts = sections.map((section) => {
    const nextHeading = section.next && newSource.slice(section.next.start, section.next.end).split('\n', 1)[0]
    const sourceTarget = nextHeading && oldRanges.findIndex((range) => oldSource.slice(range.start, range.end).split('\n', 1)[0] === nextHeading)
    const target = sourceTarget === false || sourceTarget === -1 || sourceTarget === undefined
      ? { start: markdown.length }
      : translatedRanges[sourceTarget]
    if (!target) throw new Error(`新增 Q 问答的后续章节无法映射：${nextHeading}`)
    return { start: target.start, text: section.translation }
  }).reduce((groups, insert) => {
    const existing = groups.find(({ start }) => start === insert.start)
    if (existing) existing.text += `\n\n${insert.text}`
    else groups.push(insert)
    return groups
  }, []).sort((left, right) => right.start - left.start)
  let result = markdown
  for (const insert of inserts) {
    result = `${result.slice(0, insert.start).trimEnd()}\n\n${insert.text}\n\n${result.slice(insert.start)}`
  }
  return result
}

function hunkInsideSection(markdown, hunk, section) {
  if (hunk.newCount === 0) return false
  const lines = markdown.split('\n')
  const offsetAt = (line) => lines.slice(0, line - 1).reduce((offset, value) => offset + value.length + 1, 0)
  const start = offsetAt(hunk.newStart)
  const end = offsetAt(hunk.newStart + hunk.newCount)
  return start >= section.start && end <= section.end
}

/** Group hunks by nearby source headings when a complete three-way input is too large. */
export function promptGroups(path, oldSource, translation, newSource, hunks) {
  const fullContext = { old_english: oldSource, current_chinese: translation, new_english: newSource }
  const full = makePrompt(path, [fullContext], hunks)
  if (full.input.length < 120_000) return [{ ...full, hunks }]

  const oldHeadingCount = [...oldSource.matchAll(/^#{1,6}\s/gm)].length
  const translationHeadingCount = [...translation.matchAll(/^#{1,6}\s/gm)].length
  if (oldHeadingCount !== translationHeadingCount) {
    if (full.input.length < 800_000) return [{ ...full, hunks }]
    throw new Error(`${path}: 文档过大且旧英文/中文标题数不同，无法安全分段`)
  }
  const sections = []
  hunks.forEach((hunk, id) => {
    const oldSpan = includePriorSectionForHeadingInsertion(headingSpan(oldSource, hunk.oldStart, hunk.oldCount), hunk)
    const newSpan = headingSpan(newSource, hunk.newStart, hunk.newCount)
    sections.push({ oldSpan, newSpan, hunks: [{ ...hunk, id }] })
  })
  const overlaps = (left, right) => left.first <= right.last && right.first <= left.last
  for (let index = 0; index < sections.length; index += 1) {
    for (let other = index + 1; other < sections.length;) {
      const current = sections[index]
      const candidate = sections[other]
      if (!overlaps(current.oldSpan, candidate.oldSpan) && !overlaps(current.newSpan, candidate.newSpan)) {
        other += 1
        continue
      }
      current.oldSpan = { first: Math.min(current.oldSpan.first, candidate.oldSpan.first), last: Math.max(current.oldSpan.last, candidate.oldSpan.last) }
      current.newSpan = { first: Math.min(current.newSpan.first, candidate.newSpan.first), last: Math.max(current.newSpan.last, candidate.newSpan.last) }
      current.hunks.push(...candidate.hunks)
      sections.splice(other, 1)
      other = index + 1
    }
  }
  for (const section of sections) {
    section.context = {
      old_section_span: section.oldSpan,
      new_section_span: section.newSpan,
      source_hunks: section.hunks.map(({ id }) => id),
      old_english: headingSection(oldSource, section.oldSpan),
      current_chinese: headingSection(translation, section.oldSpan),
      new_english: headingSection(newSource, section.newSpan),
    }
  }
  const packs = []
  let contexts = []
  let packedHunks = []
  for (const section of sections.values()) {
    const nextContexts = [...contexts, section.context]
    const nextHunks = [...packedHunks, ...section.hunks]
    const candidate = makePrompt(path, nextContexts, nextHunks)
    if (contexts.length && candidate.input.length > 30_000) {
      packs.push({ ...makePrompt(path, contexts, packedHunks), hunks: packedHunks })
      contexts = [section.context]
      packedHunks = section.hunks
    } else {
      contexts = nextContexts
      packedHunks = nextHunks
    }
  }
  if (contexts.length) packs.push({ ...makePrompt(path, contexts, packedHunks), hunks: packedHunks })
  return packs
}

/** Translate or independently review only the affected source hunks. */
function makePrompt(path, contexts, hunks) {
  const instruction = review
    ? '你是独立第二遍语义校对员。只修订由上游 hunk 影响的中文块，检查遗漏、反义、数字、价格、安全、法规、术语和专有名词。正确的现有中文必须保留。'
    : '你是增量翻译器。对照旧英文、旧中文、新英文，只翻译上游 hunk 引起的受影响中文块，保留其余社区译文与既有措辞。'
  const schema = '输出且只输出 JSON：{"patches":[{"hunk":0,"find":"当前中文中唯一且完整的 Markdown 块、表格行或列表项","replace":"该块更新后的中文"}]}。hunk 是本次输入 changed_hunks 数组的 0 起始位置索引，必须使用其中 changed_hunks[].hunk 的编号；不要使用 source_hunk 字段，也不要按文件全局编号。每个 hunk 至少返回一个 patch，一个 hunk 可有多个 patch。只替换确实受该 hunk 影响的中文块，禁止重写整张表或整节；未变化的表格行必须逐字保留。新增内容时 find 必须是相邻的完整中文块，replace 必须原样保留 find 并只插入新译文；删除内容时 replace 可为空。代码、命令、URL、链接目标和非 Mermaid 代码块必须与新英文一致；Mermaid 只译可见标签且拓扑不变。不要输出未修改文档，不要总结或解释。'
  const prompt = `${instruction}\n\n${schema}`
  const input = JSON.stringify({
    path,
    contexts,
    changed_hunks: hunks.map((hunk, index) => ({ hunk: index, source_hunk: hunk.id ?? index, old_lines: hunk.before, new_lines: hunk.after })),
  })
  return { prompt, input }
}

/** Ask a fresh translation context to combine only patches that target the same Chinese text. */
function resolveOverlappingPatches(path, markdown, patches, patchHunks, oldSource, newSource, scopes) {
  const conflicts = overlappingPatchGroups(markdown, patches, scopes)
  if (!conflicts.length) return patches
  const pending = resolvePatchGroups(path, markdown, patches, conflicts, patchHunks, oldSource, newSource, scopes, 0)
  const remaining = overlappingPatchGroups(markdown, pending, scopes)
  if (remaining.length) throw new Error(`${path}: 冲突修复后仍有重叠范围（${remaining.map((group) => group.join(',')).join('; ')}）`)
  return pending
}

function resolvePatchGroups(path, markdown, patches, conflicts, patchHunks, oldSource, newSource, scopes, attempt) {
  const oldRanges = headingRanges(oldSource)
  const newRanges = headingRanges(newSource)
  const currentRanges = headingRanges(markdown)
  const replacements = conflicts.flatMap((ids) => {
    if (ids.some((id) => !scopes[id])) throw new Error(`${path}: 三方章节未可靠对齐，不能自动修复重叠补丁`)
    const selected = ids.map((id) => patchHunks.find((hunk) => hunk.id === id))
    if (selected.some((hunk) => !hunk)) throw new Error(`${path}: 重叠补丁引用了未知源 hunk`)
    const oldSpans = selected.map((hunk) => includePriorSectionForHeadingInsertion(headingSpan(oldSource, hunk.oldStart, hunk.oldCount), hunk))
    const newSpans = selected.map((hunk) => headingSpan(newSource, hunk.newStart, hunk.newCount))
    const oldSpan = { first: Math.min(...oldSpans.map(({ first }) => first)), last: Math.max(...oldSpans.map(({ last }) => last)) }
    const newSpan = { first: Math.min(...newSpans.map(({ first }) => first)), last: Math.max(...newSpans.map(({ last }) => last)) }
    if (!oldRanges[oldSpan.last] || !currentRanges[oldSpan.last] || !newRanges[newSpan.last]) {
      throw new Error(`${path}: 重叠补丁的三方章节边界无法可靠映射`)
    }
    const context = {
      old_english: oldSource.slice(oldRanges[oldSpan.first].start, oldRanges[oldSpan.last].end),
      current_chinese: markdown.slice(currentRanges[oldSpan.first].start, currentRanges[oldSpan.last].end),
      new_english: newSource.slice(newRanges[newSpan.first].start, newRanges[newSpan.last].end),
      changed_hunks: selected.map(({ id, before, after }) => ({ id, before, after })),
    }
    const prompt = `你是增量翻译冲突修复器。输入包含同一中文区域内相互重叠的上游变更。对照旧英文、现有中文和新英文，只修改受这些变更影响的文本；合并同一中文块上的改动，每个目标范围只能输出一次。保留未受影响的译文。代码、命令、URL、链接目标和非 Mermaid 代码块不变；Mermaid 仅翻译标签且拓扑不变。逐一覆盖 changed_hunks 的所有 id。若一个补丁同时落实多个 id，使用 hunks 数组；否则使用只含一个 id 的 hunks 数组。输出且只输出 JSON：{"patches":[{"hunks":[0],"find":"当前中文中唯一且完整的 Markdown 块","replace":"更新后的中文"}]}。不要输出重叠的 find 范围。${attempt ? '上次修复仍有重叠；请把所有同一表格或段落中互相依赖的变更合并为单个补丁，并确保不同补丁的 find 文本互不包含、互不相交。' : ''}`
    const payload = runCodex(prompt, JSON.stringify({ path, ...context }))
    if (!Array.isArray(payload.patches)) throw new Error(`${path}: 重叠补丁修复器未返回 patches`)
    const covered = new Set()
    const fixed = payload.patches.map((patch) => {
      const hunkIds = patch.hunks ?? [patch.hunk]
      if (!Array.isArray(hunkIds) || !hunkIds.length || hunkIds.some((id) => !ids.includes(id))) {
        throw new Error(`${path}: 重叠补丁修复器引用了无效源 hunk`)
      }
      hunkIds.forEach((id) => covered.add(id))
      return { hunk: hunkIds[0], hunks: hunkIds, find: patch.find, replace: patch.replace }
    })
    if (ids.some((id) => !covered.has(id))) throw new Error(`${path}: 重叠补丁修复器未覆盖所有源 hunk ${ids}`)
    return fixed
  })
  const affected = new Set(conflicts.flat())
  const retained = patches.filter((patch) => !(patch.hunks ?? [patch.hunk]).some((id) => affected.has(id)))
  return [...retained, ...replacements]
}

const upstreamCommit = git('rev-parse', upstreamRef)
if (state.upstream_commit === upstreamCommit) {
  console.log(JSON.stringify({ status: 'current', upstream_commit: upstreamCommit }))
  process.exit(0)
}
const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', state.upstream_commit, upstreamCommit]).status === 0
if (!ancestor) throw new Error('翻译状态基线不是上游提交的祖先')

const expectedBranch = `sync/upstream-${upstreamCommit.slice(0, 7)}`
if (git('branch', '--show-current') !== expectedBranch) throw new Error(`当前分支不符：要求 ${expectedBranch}`)
if (git('rev-parse', 'HEAD') !== git('rev-parse', 'main') || git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/main')) {
  throw new Error('同步分支基线已不再与 main/origin/main 一致')
}

const names = git('diff', '--name-status', '-M', state.upstream_commit, upstreamCommit, '--', '*.md', '**/*.md')
const stateBlobs = Object.fromEntries(Object.keys(state.files).map((path) => [path, git('hash-object', path)]))
const changes = parseNameStatus(names, state.files, stateBlobs)
const selectedChanges = selectedFile ? changes.filter((change) => change.path === selectedFile) : changes
if (selectedFile && selectedChanges.length !== 1) throw new Error(`清单中找不到唯一文件：${selectedFile}`)

const implementationFiles = new Set(['docs/sync-runbook.md', 'scripts/content-validation.mjs', 'scripts/sync-planning.mjs', 'scripts/sync-translation-diff.mjs', 'test/content-validation.test.mjs', 'test/sync-planning.test.mjs'])
const unrelated = git('diff', '--name-only', 'HEAD').split('\n').filter(Boolean)
  .filter((path) => path !== 'translation-state.json' && !implementationFiles.has(path) && !changes.some((change) => change.path === path))
if (unrelated.length) throw new Error(`工作区含任务外修改：${unrelated.join(', ')}`)

const report = { base_commit: state.upstream_commit, upstream_commit: upstreamCommit, total: selectedChanges.length, changed: [], blocked: [] }
const completionPath = resolve('.translation-cache', review ? 'sync-review/completed.json' : 'sync-translate/completed.json')
const completed = existsSync(completionPath) ? readJson(completionPath) : { upstream_commit: upstreamCommit, files: {} }
if (completed.upstream_commit !== upstreamCommit) completed.files = {}
completed.upstream_commit = upstreamCommit
completed.files ??= {}
for (const change of selectedChanges) {
  if (change.status !== 'M' || change.old_path !== change.path) {
    report.blocked.push({ path: change.path, reason: `当前局部执行器不支持 ${change.status} 路径映射` })
    continue
  }
  const oldSource = gitFile(state.upstream_commit, change.old_path)
  const newSource = gitFile(upstreamCommit, change.path)
  const isQuestionBank = change.path === '00-interview-prep/01-question-bank.md'
  const oldStandaloneQuestions = new Set(standaloneQuestionSections(oldSource).map(({ heading }) => heading))
  const addedStandaloneQuestions = standaloneQuestionSections(newSource).filter(({ heading }) => !oldStandaloneQuestions.has(heading))
  const workingTranslation = readFileSync(change.path, 'utf8')
  const workingHash = createHash('sha256').update(workingTranslation).digest('hex')
  if (completed.files[change.path] === workingHash) {
    report.changed.push({ path: change.path, completed: true })
    continue
  }
  const translation = isQuestionBank && !review ? gitFile('HEAD', change.path) : workingTranslation
  const diff = git('diff', '--unified=0', '--no-ext-diff', '--no-color', state.upstream_commit, upstreamCommit, '--', change.path)
  const hunks = parseUnifiedDiff(diff).map((hunk, id) => ({ ...hunk, id }))
  if (!hunks.length) {
    report.blocked.push({ path: change.path, reason: 'changes 清单有文件，但无法提取 Git hunk' })
    continue
  }
  const oldQuestionIds = new Set(questionSections(oldSource).map(({ id }) => id))
  const addedQuestions = isQuestionBank ? questionSections(newSource).filter(({ id }) => !oldQuestionIds.has(id)) : []
  const addedQuestionIds = addedQuestions.map(({ id }) => id)
  const addedHeadings = isQuestionBank ? translateAddedHeadings(change.path, oldSource, newSource, translation, addedQuestions) : []
  const baseTranslation = withoutAddedHeadings(withoutQuestionSections(translation, addedQuestionIds), addedHeadings)
  // Keep mixed hunks intact: the last hunk also changes the preceding Q128 section.
  const patchHunks = hunks.filter((hunk) =>
    !hunkIsNonMermaidCodeOnly(oldSource, hunk, 'old') &&
    !hunkIsNonMermaidCodeOnly(newSource, hunk, 'new') &&
    !addedStandaloneQuestions.some((section) => hunkInsideSection(newSource, hunk, section)),
  )
  const sourceSections = headingRanges(oldSource)
  const translationSections = headingRanges(baseTranslation)
  const sectionAlignmentReliable = sourceSections.length === translationSections.length
  if (!sectionAlignmentReliable && !change.community_edited) {
    throw new Error(`${change.path}: 旧英文与中文标题数量不同，无法按章节可靠定位`)
  }
  const groups = patchHunks.length ? promptGroups(change.path, oldSource, baseTranslation, newSource, patchHunks) : []
  report.changed.push({ path: change.path, hunks: hunks.length, complete_question_blocks: addedQuestions.length, standalone_question_blocks: addedStandaloneQuestions.length, independent_contexts: groups.length, largest_input_chars: groups.length ? Math.max(...groups.map((group) => group.input.length)) : 0 })
  if (dryRun) continue

  const standaloneQuestionTranslations = translateStandaloneQuestions(change.path, addedStandaloneQuestions)
  const patches = groups.flatMap((group) => {
    const firstPass = restoreInsertionPatches(mapPatchHunks(runCodex(group.prompt, group.input), group.hunks), group.hunks)
    const groupContexts = JSON.parse(group.input).contexts
    const incomplete = new Set(incompleteHunkIds(firstPass, group.hunks, review, groupContexts))
    if (incomplete.size === 0) return validatePatches(firstPass, group.hunks)

    const incompleteHunks = group.hunks.filter((hunk, index) => incomplete.has(hunk.id ?? index))
    const originalInput = JSON.parse(group.input)
    const contexts = originalInput.contexts.filter((context) =>
      !context.source_hunks || context.source_hunks.some((id) => incomplete.has(id)),
    )
    const retry = makePrompt(change.path, contexts, incompleteHunks)
    const retryPrompt = `${retry.prompt}\n\n上次输出遗漏或未合规处理了源 hunk：${[...incomplete].join(', ')}。本次必须逐一返回这些 hunk 的补丁；hunk 字段使用 changed_hunks 数组中的 0 起始位置索引。新增内容的 find 必须逐字复制自对应 context.current_chinese，且 replace 原样保留 find，只在其前后插入新译文；不得替换该 context 之外的问答或段落。`
    const secondPass = restoreInsertionPatches(mapPatchHunks(runCodex(retryPrompt, retry.input), retry.hunks ?? incompleteHunks), incompleteHunks)
    const retained = (firstPass.patches ?? []).filter((patch) => !incomplete.has(patch.hunk))
    return validatePatches({ patches: [...retained, ...(secondPass.patches ?? [])] }, group.hunks)
  })
  const retainedPatches = patches.map((patch) => change.path === '01-foundations/04-transformer-architecture.md' &&
    patch.replace === '' && patch.find.includes('## 非绑定 vs. 绑定 Embedding（词嵌入）') &&
    newSource.includes('## Untied vs. Tied Embeddings') ? { ...patch, replace: patch.find } : patch)
  let localizedPatches = combineDependentPatches(removeCodeBlockPatches({ patches: retainedPatches }, baseTranslation).patches, baseTranslation)
  const scopes = sectionAlignmentReliable ? Object.fromEntries(patchHunks.map((hunk) => {
    const span = includePriorSectionForHeadingInsertion(headingSpan(oldSource, hunk.oldStart, hunk.oldCount), hunk)
    return [hunk.id, { start: translationSections[span.first].start, end: translationSections[span.last].end }]
  })) : {}
  let updated
  try {
    localizedPatches = resolveOverlappingPatches(change.path, baseTranslation, localizedPatches, patchHunks, oldSource, newSource, scopes)
    const translatableIds = new Set(patchHunks.map(({ id }) => id))
    localizedPatches = localizedPatches.filter((patch) => (patch.hunks ?? [patch.hunk]).every((id) => translatableIds.has(id)))
    const localizedHunks = patchHunks.filter(({ id }) => localizedPatches.some((patch) => (patch.hunks ?? [patch.hunk]).includes(id)))
    if (process.env.SYNC_DEBUG_PATCHES) console.error(JSON.stringify({ localized_hunks: localizedHunks.map(({ id }) => id), patches: localizedPatches.map(({ hunk, hunks }) => hunks ?? [hunk]) }))
    updated = patchHunks.length
      ? applyLocalizedPatches(baseTranslation, localizedPatches, localizedHunks.map(({ id }) => id), scopes)
      : baseTranslation
  } catch (error) {
    if (process.env.SYNC_DEBUG_PATCHES) console.error(JSON.stringify(localizedPatches.map(({ hunk, find, replace }) => ({ hunk, find: find.slice(0, 100), find_length: find.length, replace_length: replace.length }))))
    throw new Error(`${change.path}: ${error.message}`)
  }
  if (addedQuestions.length) {
    const questionTranslations = translateAddedQuestions(change.path, addedQuestions, translation)
    updated = upsertQuestionSections(updated, questionTranslations)
  }
  updated = insertStandaloneQuestions(updated, oldSource, newSource, standaloneQuestionTranslations)
  updated = upsertQuestionHeadings(updated, addedHeadings)
  if (isQuestionBank) updated = translateAddedLinkedLines(change.path, oldSource, newSource, translation, updated)
  updated = removeSurplusExternalLinks(newSource, updated)
  updated = repairMissingNumericLines(change.path, oldSource, newSource, updated, hunks)
  updated = alignNonMermaidFenceInfo(newSource, updated)
  if (change.path === '01-foundations/04-transformer-architecture.md' && newSource.includes('## Untied vs. Tied Embeddings')) {
    updated = moveSectionBefore(updated, '## 非绑定 vs. 绑定 Embedding（词嵌入）', '## 现代架构变体')
  }
  if (change.path === '01-foundations/05-embeddings-and-vector-spaces.md') updated = repairEmbeddingSectionOrder(updated)
  const structureIssues = compareStructure(newSource, updated)
  if (structureIssues.length) {
    if (process.env.SYNC_DEBUG_SAVE) writeFileSync(resolve('.translation-cache/sync-preview.md'), updated)
    const mismatch = (left, right) => {
      const index = left.findIndex((value, position) => JSON.stringify(value) !== JSON.stringify(right[position]))
      return { expected: left.length, actual: right.length, first_mismatch: index }
    }
    const expectedHeadings = headingShape(newSource)
    const actualHeadings = headingShape(updated)
    const expectedCode = codeBlocks(newSource)
    const actualCode = codeBlocks(updated)
    const sourceLinks = linkTargets(newSource).filter((url) => /^(?:https?:|mailto:)/.test(url)).sort()
    const targetLinks = linkTargets(updated).filter((url) => /^(?:https?:|mailto:)/.test(url)).sort()
    const missingNumbers = numericTokens(newSource).filter((number) => !numericTokens(updated).includes(number))
    const headingMismatch = mismatch(expectedHeadings, actualHeadings)
    const around = (items) => items.slice(Math.max(0, headingMismatch.first_mismatch - 3), headingMismatch.first_mismatch + 6)
    console.error(JSON.stringify({ headings: { ...headingMismatch, expected: around(expectedHeadings), actual: around(actualHeadings) }, code_blocks: { ...mismatch(expectedCode, actualCode), expected: expectedCode[9]?.slice(0, 120), actual: actualCode[9]?.slice(0, 120) }, numbers: { missing: missingNumbers, lines: newSource.split('\n').filter((line) => /\$?(?:3B|7B|900M|9B|2,603\.13686)/.test(line)) }, external_links: { ...mismatch(sourceLinks, targetLinks), missing: sourceLinks.filter((url) => !targetLinks.includes(url)), extra: targetLinks.filter((url) => !sourceLinks.includes(url)) } }))
    throw new Error(`${change.path}: 结构或不变量校验失败：${structureIssues.join('、')}；译文未写入`)
  }
  const target = resolve(change.path)
  const staged = `${target}.sync-tmp`
  writeFileSync(staged, updated)
  renameSync(staged, target)
  completed.files[change.path] = createHash('sha256').update(updated).digest('hex')
  writeFileSync(completionPath, `${JSON.stringify(completed, null, 2)}\n`)
  console.log(`${review ? '二遍校对' : '增量翻译'} ${change.path} ${hunks.length} hunks`)
}

console.log(JSON.stringify(report, null, 2))
if (report.blocked.length) process.exitCode = 1
