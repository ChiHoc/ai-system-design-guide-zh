#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { slugifyHeading } from './content-validation.mjs'

const sourceRoot = resolve(process.argv[2] ?? '')
const mirrorRoot = process.cwd()
if (!process.argv[2]) {
  console.error('用法: node scripts/rewrite-anchors.mjs <上游目录>')
  process.exit(2)
}

function listMarkdown(directory, prefix = '') {
  return readdirSync(directory).flatMap((name) => {
    const absolute = join(directory, name)
    const relative = prefix ? `${prefix}/${name}` : name
    if (statSync(absolute).isDirectory()) return listMarkdown(absolute, relative)
    return name.endsWith('.md') ? [relative] : []
  })
}

function headingSlugs(markdown) {
  const counts = new Map()
  return markdown.split('\n').filter((line) => /^#{1,6}\s/.test(line)).map((line) => {
    const title = line.replace(/^#{1,6}\s+/, '').replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
      .replace(/<[^>]+>/g, '').replace(/[`*_]/g, '')
    const base = slugifyHeading(title)
    const count = counts.get(base) ?? 0
    counts.set(base, count + 1)
    return count === 0 ? base : `${base}-${count}`
  })
}

function targetFile(fromFile, rawPath) {
  const relative = normalize(join(dirname(fromFile), rawPath || fromFile.split('/').pop()))
  if (existsSync(join(sourceRoot, relative))) return relative
  if (existsSync(join(sourceRoot, `${relative}.md`))) return `${relative}.md`
  if (existsSync(join(sourceRoot, relative, 'index.md'))) return join(relative, 'index.md')
  return null
}

const maps = new Map()
function anchorMap(file) {
  if (maps.has(file)) return maps.get(file)
  const sourceMarkdown = readFileSync(join(sourceRoot, file), 'utf8')
  const translatedMarkdown = readFileSync(join(mirrorRoot, file), 'utf8')
  const sourceSlugs = headingSlugs(sourceMarkdown)
  const translatedSlugs = headingSlugs(translatedMarkdown)
  const map = new Map(sourceSlugs.map((slug, index) => [slug, translatedSlugs[index]]))

  // 上游目录常用人为缩短的锚点，未必等于标题 slug；按目录项与后续 H2 的顺序建立别名。
  const sourceLines = sourceMarkdown.split('\n')
  const sourceH2 = sourceLines.map((line, index) => ({ line, index }))
    .filter(({ line }) => /^##\s+/.test(line))
  const translatedH2 = translatedMarkdown.split('\n').filter((line) => /^##\s+/.test(line))
  const toc = sourceH2.findIndex(({ line }) => /^##\s+(?:table of contents|contents)\s*$/i.test(line))
  if (toc >= 0 && sourceH2[toc + 1] && translatedH2[toc + 1]) {
    const tocLines = sourceLines.slice(sourceH2[toc].index + 1, sourceH2[toc + 1].index)
    const aliases = tocLines.flatMap((line) => [...line.matchAll(/\]\(#([^)]+)\)/g)].map((match) => match[1]))
    const translatedContentSlugs = headingSlugs(translatedH2.slice(toc + 1).join('\n'))
    aliases.forEach((alias, index) => {
      if (translatedContentSlugs[index]) map.set(alias, translatedContentSlugs[index])
    })
  }
  maps.set(file, map)
  return map
}

const linkPattern = /(!?\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g
for (const file of listMarkdown(sourceRoot)) {
  const target = join(mirrorRoot, file)
  const translation = readFileSync(target, 'utf8')
  const rewritten = translation.replace(linkPattern, (match, start, link, end) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(link) || !link.includes('#')) return match
    const hash = link.indexOf('#')
    const rawPath = link.slice(0, hash)
    const rawFragment = link.slice(hash + 1)
    const linkedFile = targetFile(file, rawPath)
    if (!linkedFile) return match
    let fragment
    try { fragment = decodeURIComponent(rawFragment) } catch { return match }
    const translated = anchorMap(linkedFile).get(fragment)
    return translated ? `${start}${rawPath}#${translated}${end}` : match
  })
  writeFileSync(target, rewritten)
}

console.log('站内锚点已按中文标题重写。')
