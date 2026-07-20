#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { compareStructure, untranslatedBlocks, untranslatedHeadings } from './content-validation.mjs'

const sourceRoot = resolve(process.argv[2] ?? '')
const prefixes = (process.argv[3] ?? '').split(',').filter(Boolean)
if (!process.argv[2]) {
  console.error('用法: node scripts/audit-source.mjs <上游目录> [目录,...]')
  process.exit(2)
}

/** 递归读取上游 Markdown 清单，不把镜像专属页面混入结构审计。 */
function listMarkdown(directory, prefix = '') {
  return readdirSync(directory).flatMap((name) => {
    const absolute = join(directory, name)
    const relative = prefix ? `${prefix}/${name}` : name
    if (statSync(absolute).isDirectory()) return listMarkdown(absolute, relative)
    return name.endsWith('.md') ? [relative] : []
  })
}

const failures = []
for (const file of listMarkdown(sourceRoot).filter((path) => prefixes.length === 0 || prefixes.some((prefix) =>
  prefix === '__root__' ? !path.includes('/') : path.startsWith(`${prefix}/`),
))) {
  const issues = compareStructure(readFileSync(join(sourceRoot, file), 'utf8'), readFileSync(resolve(file), 'utf8'))
  if (untranslatedBlocks(readFileSync(resolve(file), 'utf8')).length) issues.push('疑似漏译长段落')
  if (untranslatedHeadings(readFileSync(resolve(file), 'utf8')).length) issues.push('疑似漏译英文标题')
  if (issues.length) failures.push({ file, issues })
}

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2))
  process.exit(1)
}
console.log('译文结构与上游一致。')
