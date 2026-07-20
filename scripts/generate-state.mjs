#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourceRoot = resolve(process.argv[2] ?? '')
if (!process.argv[2]) {
  console.error('用法: node scripts/generate-state.mjs <上游仓库目录>')
  process.exit(2)
}

const upstreamCommit = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const files = execFileSync('git', ['-C', sourceRoot, 'ls-tree', '-r', '--name-only', 'HEAD'], { encoding: 'utf8' })
  .trim().split('\n').filter((file) => file.endsWith('.md')).sort()
const syncedAt = new Date().toISOString()
const previous = existsSync('translation-state.json')
  ? JSON.parse(readFileSync('translation-state.json', 'utf8'))
  : { files: {} }
const entries = Object.fromEntries(files.map((file) => {
  const sourceBlob = execFileSync('git', ['-C', sourceRoot, 'rev-parse', `HEAD:${file}`], { encoding: 'utf8' }).trim()
  const translationBlob = execFileSync('git', ['hash-object', file], { encoding: 'utf8' }).trim()
  const old = previous.files?.[file]
  const unchanged = old?.source_blob === sourceBlob && old?.translation_blob === translationBlob
  return [file, unchanged ? old : {
    source_blob: sourceBlob,
    translation_blob: translationBlob,
    review: 'automated-second-pass',
    synced_at: syncedAt,
  }]
}))

writeFileSync('translation-state.json', `${JSON.stringify({
  upstream_repository: 'ombharatiya/ai-system-design-guide',
  upstream_commit: upstreamCommit,
  files: entries,
}, null, 2)}\n`)
console.log(`已记录 ${files.length} 个文件，基线 ${upstreamCommit.slice(0, 7)}。`)
