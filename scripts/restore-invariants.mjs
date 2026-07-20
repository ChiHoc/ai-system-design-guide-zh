#!/usr/bin/env node

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const sourceRoot = resolve(process.argv[2] ?? '')
if (!process.argv[2]) {
  console.error('用法: node scripts/restore-invariants.mjs <上游目录>')
  process.exit(2)
}

/** 递归列出上游 Markdown，确保只修复镜像对应页面。 */
function listMarkdown(directory, prefix = '') {
  return readdirSync(directory).flatMap((name) => {
    const absolute = join(directory, name)
    const relative = prefix ? `${prefix}/${name}` : name
    if (statSync(absolute).isDirectory()) return listMarkdown(absolute, relative)
    return name.endsWith('.md') ? [relative] : []
  })
}

const fencePattern = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm
const linkPattern = /(!?\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g

for (const file of listMarkdown(sourceRoot)) {
  const source = readFileSync(join(sourceRoot, file), 'utf8')
  let translation = readFileSync(resolve(file), 'utf8')

  // 可执行示例与 Mermaid 结构均以原文为规范；图中英文标签属于允许保留的专业术语。
  const sourceFences = [...source.matchAll(fencePattern)].map((match) => match[0])
  const translatedFences = [...translation.matchAll(fencePattern)]
  if (sourceFences.length !== translatedFences.length) {
    console.warn(`${file}: 代码围栏数量不同，跳过自动还原`)
  } else {
    let index = 0
    translation = translation.replace(fencePattern, () => sourceFences[index++])
  }

  // 链接文字保留中文，目标按出现顺序恢复为上游原值。
  const sourceTargets = [...source.matchAll(linkPattern)].map((match) => match[2])
  const translatedTargets = [...translation.matchAll(linkPattern)]
  if (sourceTargets.length !== translatedTargets.length) {
    console.warn(`${file}: 链接数量不同，跳过自动还原`)
  } else {
    let index = 0
    translation = translation.replace(linkPattern, (_match, start, _target, end) =>
      `${start}${sourceTargets[index++]}${end}`,
    )
  }

  writeFileSync(resolve(file), translation)
}

console.log('代码围栏、Mermaid 与链接目标已按上游还原。')
