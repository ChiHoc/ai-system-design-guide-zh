#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const review = args.includes('--review')
const sourceIndex = args.indexOf('--source')
const prefixIndex = args.indexOf('--prefix')
const modelIndex = args.indexOf('--model')
const afterIndex = args.indexOf('--after')
const sourceRoot = sourceIndex >= 0 ? resolve(args[sourceIndex + 1]) : null
const prefixes = prefixIndex >= 0 ? args[prefixIndex + 1].split(',') : []
const model = modelIndex >= 0 ? args[modelIndex + 1] : 'gpt-5.3-codex-spark'
const after = afterIndex >= 0 ? args[afterIndex + 1] : null
let files = args.filter((arg, index) =>
  !arg.startsWith('--') && index !== sourceIndex + 1 && index !== prefixIndex + 1
    && index !== modelIndex + 1 && index !== afterIndex + 1,
)

/** 返回上游中的全部 Markdown，相对路径保持稳定。 */
function listMarkdown(directory, prefix = '') {
  return readdirSync(directory).flatMap((name) => {
    const absolute = join(directory, name)
    const relative = prefix ? `${prefix}/${name}` : name
    if (statSync(absolute).isDirectory()) return listMarkdown(absolute, relative)
    return name.endsWith('.md') ? [relative] : []
  })
}

if (args.includes('--all') && sourceRoot) {
  files = listMarkdown(sourceRoot).filter((file) => prefixes.length === 0 || prefixes.some((prefix) =>
    prefix === '__root__' ? !file.includes('/') : file.startsWith(`${prefix}/`),
  )).filter((file) => !after || file.localeCompare(after, 'en') >= 0)
}

if (!sourceRoot || files.length === 0) {
  console.error('用法: node scripts/translate-content.mjs --source <上游目录> [--all] [--prefix <目录,...>] [--after <文件>] [--review] [--model <模型>] <Markdown 文件...>')
  process.exit(2)
}

/** 在代码围栏之外按标题切分，避免单次模型输出过长。 */
function splitMarkdown(markdown, maxChars = 7_000) {
  const lines = markdown.split(/(?<=\n)/)
  const chunks = []
  let current = ''
  let fence = null

  for (const line of lines) {
    const marker = line.match(/^\s*(```+|~~~+)/)?.[1]
    if (marker) fence = fence ? null : marker[0]
    const isBoundary = !fence && /^#{2,4}\s/.test(line)
    if (isBoundary && current.length >= maxChars) {
      chunks.push(current)
      current = ''
    }
    current += line
  }
  if (current) chunks.push(current)
  return chunks
}

/** 按标题序号对齐原文和译文，再以原文长度合并分块，避免中英文长度差造成错配。 */
function pairReviewChunks(source, translation, maxChars = 7_000) {
  const sections = (markdown) => {
    const result = []
    let current = ''
    let fence = null
    for (const line of markdown.split(/(?<=\n)/)) {
      const marker = line.match(/^\s*(```+|~~~+)/)?.[1]
      if (marker) fence = fence ? null : marker[0]
      if (!fence && /^#{2,4}\s/.test(line) && current) {
        result.push(current)
        current = ''
      }
      current += line
    }
    if (current) result.push(current)
    return result
  }

  const sourceSections = sections(source)
  const translationSections = sections(translation)
  if (sourceSections.length !== translationSections.length) {
    throw new Error(`原文与译文标题分段数量不同（${sourceSections.length} / ${translationSections.length}）`)
  }

  const pairs = []
  let sourceChunk = ''
  let translationChunk = ''
  for (let index = 0; index < sourceSections.length; index += 1) {
    if (sourceChunk.length >= maxChars) {
      pairs.push([sourceChunk, translationChunk])
      sourceChunk = ''
      translationChunk = ''
    }
    sourceChunk += sourceSections[index]
    translationChunk += translationSections[index]
  }
  if (sourceChunk) pairs.push([sourceChunk, translationChunk])
  return pairs
}

function runCodex(prompt, input, outputPath) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = spawnSync('codex', [
      'exec', '-m', model, '-c', "model_reasoning_effort='low'",
      '-s', 'read-only', '-C', tmpdir(), '--skip-git-repo-check',
      '--ignore-user-config', '--disable', 'image_generation', '--ephemeral', '-o', outputPath, prompt,
    ], { input, encoding: 'utf8', stdio: ['pipe', 'ignore', 'pipe'] })
    if (result.status === 0) break
    if (attempt === 3) {
      const detail = result.stderr?.trim().slice(-1_000) ?? ''
      throw new Error(`Codex 连续失败，最后退出码 ${result.status}\n${detail}`)
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 5_000)
  }
  const output = readFileSync(outputPath, 'utf8').trim()
  if (!output) throw new Error('Codex 返回空译文')
  return output.replace(/^```(?:markdown)?\s*\n/, '').replace(/\n```$/, '')
}

/** 翻译前把非 Mermaid 代码围栏替换为稳定占位符，模型永远接触不到代码正文。 */
function protectCodeFences(markdown) {
  const fences = []
  const protectedMarkdown = markdown.replace(/^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1\s*$/gm, (block, marker, info) => {
    if (info.trim() === 'mermaid') return block
    const token = `@@AI_GUIDE_CODE_BLOCK_${fences.length}@@`
    fences.push(block)
    return token
  })
  return { markdown: protectedMarkdown, fences }
}

/** 将占位符严格按序还原；任何遗漏都视为不可信输出。 */
function restoreCodeFences(markdown, fences) {
  let restored = markdown
  fences.forEach((block, index) => {
    const token = `@@AI_GUIDE_CODE_BLOCK_${index}@@`
    if (!restored.includes(token)) throw new Error(`代码占位符 ${index} 丢失`)
    restored = restored.replace(token, block)
  })
  return restored
}

function tokenLetters(index) {
  let value = index + 1
  let result = ''
  while (value > 0) {
    value -= 1
    result = String.fromCharCode(65 + (value % 26)) + result
    value = Math.floor(value / 26)
  }
  return result
}

/** 数字、价格和百分比在送入模型前替换为短哨兵串，避免单位换算或改写。 */
function protectNumbers(markdown) {
  const numbers = []
  const protectedMarkdown = markdown.replace(/(?<![\p{L}\p{N}_])\d+(?:[.,]\d+)*(?:%|[KMB])?(?![\p{L}\p{N}_])/gu, (value) => {
    const token = `ZXQNUM${tokenLetters(numbers.length)}QXZ`
    numbers.push(value)
    return token
  })
  return { markdown: protectedMarkdown, numbers }
}

function restoreNumbers(markdown, numbers) {
  let restored = markdown
  numbers.forEach((value, index) => {
    const token = `ZXQNUM${tokenLetters(index)}QXZ`
    if (!restored.includes(token)) throw new Error(`数字占位符 ${tokenLetters(index)} 丢失`)
    restored = restored.replace(token, value)
  })
  if (/ZXQNUM[A-Z]+QXZ/.test(restored)) throw new Error('数字占位符重复或出现未知项')
  return restored
}

/** 与 VitePress 保持一致的标题 slug 规则。 */
function slugifyHeading(title) {
  return title.normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, '_$1')
    .toLowerCase()
}

/** 目录链接按对应中文 H2 重写，避免沿用英文短锚点后跳转失效。 */
function rewriteTableOfContents(source, translation) {
  const sourceLines = source.split('\n')
  const translatedLines = translation.split('\n')
  const tocIndex = sourceLines.findIndex((line) => /^##\s+(?:table of contents|contents)\s*$/i.test(line))
  if (tocIndex < 0) return translation
  const firstSection = sourceLines.findIndex((line, index) => index > tocIndex && /^##\s+/.test(line))
  if (firstSection < 0) return translation

  const sourceHeadings = sourceLines.slice(firstSection).filter((line) => /^##\s+/.test(line))
  const translatedHeadings = translatedLines.filter((line) => /^##\s+/.test(line)).slice(1)
  const tocLinks = sourceLines.slice(tocIndex + 1, firstSection)
    .filter((line) => /\]\(#[^)]+\)/.test(line))
  if (sourceHeadings.length !== translatedHeadings.length || tocLinks.length > translatedHeadings.length) return translation

  let linkIndex = 0
  const translatedTocIndex = translatedLines.findIndex((line) => /^##\s+/.test(line))
  const translatedFirstSection = translatedLines.findIndex((line, index) => index > translatedTocIndex && /^##\s+/.test(line))
  for (let index = translatedTocIndex + 1; index < translatedFirstSection && linkIndex < tocLinks.length; index += 1) {
    if (!/\]\(#[^)]+\)/.test(translatedLines[index])) continue
    const heading = translatedHeadings[linkIndex].replace(/^##\s+/, '').replace(/[`*_]/g, '')
    translatedLines[index] = translatedLines[index].replace(/\]\(#[^)]+\)/, `](#${slugifyHeading(heading)})`)
    linkIndex += 1
  }
  return translatedLines.join('\n')
}

const translatePrompt = '将 stdin 中的完整 Markdown 忠实翻译为简体中文，只输出翻译后的完整 Markdown，不要解释或用代码围栏包裹全文。正文、标题、面试题、表格标签和上一篇/下一篇导航都要翻译，不得遗留完整英文句子；英文专业术语优先，首次出现附中文解释。保持 Markdown 结构、表格、URL、图片路径、数字、公式、代码块、命令和标识符不变；Mermaid 只翻译可见标签。所有 ZXQNUM...QXZ 与 @@AI_GUIDE_CODE_BLOCK_*@@ 占位符必须原样保留且各出现一次。不得总结、删减或扩写。'
const reviewPrompt = '校对 stdin 中 SOURCE 与 TRANSLATION 两段 Markdown。只输出修正后的完整中文 TRANSLATION，不要解释或用代码围栏包裹。修正遗漏、反义、数字、价格、安全、法规和术语错误；正文、标题、面试题、表格标签和上一篇/下一篇导航都要翻译，不得遗留完整英文句子。保持 SOURCE 的 Markdown 结构、表格、URL、图片、数字、公式、代码块、命令和标识符，保留已有正确中文。英文专业术语优先，首次出现附中文解释。所有 ZXQNUM...QXZ 与 @@AI_GUIDE_CODE_BLOCK_*@@ 占位符必须原样保留且各出现一次。不得总结、删减或扩写。'
const cacheRoot = resolve('.translation-cache', review ? 'review' : 'translate')
mkdirSync(cacheRoot, { recursive: true })

for (const file of files) {
    const source = readFileSync(join(sourceRoot, file), 'utf8')
    const current = review ? readFileSync(resolve(file), 'utf8') : null
    const reviewPairs = current ? pairReviewChunks(source, current) : []
    const sourceChunks = review ? reviewPairs.map(([sourceChunk]) => sourceChunk) : splitMarkdown(source)
    const currentChunks = reviewPairs.map(([, translationChunk]) => translationChunk)

    const translated = []
    for (let index = 0; index < sourceChunks.length; index += 1) {
      const protectedSource = protectCodeFences(sourceChunks[index])
      const protectedTranslation = review ? protectCodeFences(currentChunks[index]) : null
      if (protectedTranslation && protectedSource.fences.length !== protectedTranslation.fences.length) {
        throw new Error(`${file}: 原文与译文代码围栏数量不同，拒绝自动校对`)
      }
      const numberedSource = protectNumbers(protectedSource.markdown)
      const numberedTranslation = protectedTranslation ? protectNumbers(protectedTranslation.markdown) : null
      if (numberedTranslation && JSON.stringify(numberedSource.numbers) !== JSON.stringify(numberedTranslation.numbers)) {
        throw new Error(`${file}: 原文与译文数字序列不同，需先重新翻译`)
      }
      const input = review
        ? `<SOURCE>\n${numberedSource.markdown}\n</SOURCE>\n<TRANSLATION>\n${numberedTranslation.markdown}\n</TRANSLATION>`
        : numberedSource.markdown
      const key = createHash('sha256').update(`v6\0${model}\0${review ? 'review' : 'translate'}\0${input}`).digest('hex')
      const outputPath = join(cacheRoot, `${key}.md`)
      let protectedOutput
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        if (!existsSync(outputPath)) runCodex(review ? reviewPrompt : translatePrompt, input, outputPath)
        try {
          const withNumbers = restoreNumbers(readFileSync(outputPath, 'utf8').trim(), numberedSource.numbers)
          protectedOutput = restoreCodeFences(withNumbers, protectedSource.fences)
          break
        } catch (error) {
          unlinkSync(outputPath)
          if (attempt === 3) throw error
        }
      }
      translated.push(protectedOutput)
      console.log(`${review ? '校对' : '翻译'} ${file} ${index + 1}/${sourceChunks.length}`)
    }

    const output = `${rewriteTableOfContents(source, translated.join('\n\n'))}\n`
    // 中文以 UTF-8 字节衡量更可靠；按 JS 字符数会把正常的紧凑译文误判为截断。
    if (Buffer.byteLength(output) < Buffer.byteLength(source) * 0.45) {
      throw new Error(`${file}: 输出长度异常，拒绝覆盖`)
    }
    const target = resolve(file)
    const staged = `${target}.translation-tmp`
    writeFileSync(staged, output)
    renameSync(staged, target)
}
