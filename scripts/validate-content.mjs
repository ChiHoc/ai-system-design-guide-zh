#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { brokenRelativeLinks, compareStructure, missingTranslations, readJson, untranslatedBlocks, untranslatedHeadings } from './content-validation.mjs'

const root = process.cwd()
const state = readJson(resolve(root, 'translation-state.json'))
const issues = []

for (const file of missingTranslations(Object.keys(state.files), root)) issues.push(`${file}: 译文缺失`)

for (const [file, metadata] of Object.entries(state.files)) {
  const target = resolve(root, file)
  if (!existsSync(target)) continue
  let source
  try {
    source = execFileSync('git', ['show', `${state.upstream_commit}:${file}`], { encoding: 'utf8' })
  } catch {
    issues.push(`${file}: 无法读取上游基线 ${state.upstream_commit}`)
    continue
  }
  const translation = readFileSync(target, 'utf8')
  for (const issue of compareStructure(source, translation)) issues.push(`${file}: ${issue}不一致`)
  if (untranslatedBlocks(translation).length) issues.push(`${file}: 存在疑似漏译的长英文段落`)
  if (untranslatedHeadings(translation).length) issues.push(`${file}: 存在疑似漏译的英文标题`)
  for (const link of brokenRelativeLinks(translation, file, root)) issues.push(`${file}: 相对链接失效 ${link}`)

  const sourceBlob = execFileSync('git', ['rev-parse', `${state.upstream_commit}:${file}`], { encoding: 'utf8' }).trim()
  if (sourceBlob !== metadata.source_blob) issues.push(`${file}: source_blob 与基线不一致`)
  const translationBlob = execFileSync('git', ['hash-object', file], { encoding: 'utf8' }).trim()
  if (translationBlob !== metadata.translation_blob) issues.push(`${file}: translation_blob 与工作树不一致`)
}

const sourceFiles = execFileSync('git', [
  'ls-tree', '-r', '--name-only', state.upstream_commit,
], { encoding: 'utf8' }).trim().split('\n').filter((file) => file.endsWith('.md')).sort()
const trackedFiles = Object.keys(state.files).sort()
if (JSON.stringify(sourceFiles) !== JSON.stringify(trackedFiles)) issues.push('上游 Markdown 文件清单与 translation-state.json 不一致')

if (issues.length) {
  console.error(issues.join('\n'))
  process.exit(1)
}
console.log(`已验证 ${trackedFiles.length} 个中文镜像文件。`)
