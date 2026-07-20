import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { brokenRelativeLinks, compareStructure, missingTranslations, untranslatedBlocks, untranslatedHeadings } from '../scripts/content-validation.mjs'

const source = '# Title\n\nValue 42.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x = 1\n```\n\n[Doc](next.md)\n'
const translation = '# 标题\n\n数值 42。\n\n| 甲 | 乙 |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x = 1\n```\n\n[文档](next.md)\n'

test('接受结构一致的译文', () => assert.deepEqual(compareStructure(source, translation), []))
test('检测代码块变化', () => assert.ok(compareStructure(source, translation.replace('const x = 1', 'const x = 2')).includes('非 Mermaid 代码块')))
test('检测 Mermaid 拓扑变化但允许标签翻译', () => {
  const mermaidSource = '# T\n```mermaid\ngraph LR\nA[User] --> B[Model]\n```\n'
  const translatedLabel = '# 标题\n```mermaid\ngraph LR\nA[用户] --> B[模型]\n```\n'
  assert.deepEqual(compareStructure(mermaidSource, translatedLabel), [])
  assert.ok(compareStructure(mermaidSource, translatedLabel.replace('-->', '---')).includes('Mermaid 结构'))
})
test('检测表格破坏', () => assert.ok(compareStructure(source, translation.replace('| 甲 | 乙 |', '| 甲 |')).includes('表格结构')))
test('检测数字遗漏', () => assert.ok(compareStructure(source, translation.replace('数值 42。', '数值。')).includes('数字')))
test('允许把英文数字词补充为阿拉伯数字', () => assert.ok(!compareStructure(source, translation.replace('数值 42。', '数值 42，共 three（3）项。')).includes('数字')))
test('检测失效相对链接', () => {
  const root = mkdtempSync(join(tmpdir(), 'guide-links-'))
  mkdirSync(join(root, 'chapter'))
  writeFileSync(join(root, 'chapter', 'current.md'), '')
  assert.deepEqual(brokenRelativeLinks('[缺失](missing.md)', 'chapter/current.md', root), ['missing.md'])
})

test('检测中文标题的失效锚点', () => {
  const root = mkdtempSync(join(tmpdir(), 'guide-anchor-'))
  writeFileSync(join(root, 'current.md'), '# 标题\n\n## 中文章节\n')
  assert.deepEqual(brokenRelativeLinks('[有效](#中文章节)', 'current.md', root), [])
  assert.deepEqual(brokenRelativeLinks('[失效](#english-anchor)', 'current.md', root), ['#english-anchor'])
})

test('检测状态表中的漏文件', () => {
  const root = mkdtempSync(join(tmpdir(), 'guide-missing-'))
  writeFileSync(join(root, 'present.md'), '')
  assert.deepEqual(missingTranslations(['present.md', 'missing.md'], root), ['missing.md'])
})

test('检测疑似整段漏译的英文正文', () => {
  const english = 'This production architecture uses a dedicated routing layer that selects providers, applies retries, records telemetry, and protects every downstream service from cascading failures. '.repeat(2)
  assert.equal(untranslatedBlocks(english).length, 1)
  assert.equal(untranslatedBlocks(`这是一段已经完成翻译的中文正文。${english}`).length, 0)
})

test('检测疑似漏译的英文面试题标题', () => {
  assert.deepEqual(untranslatedHeadings('### Q: Why do system prompts carry more weight than user prompts?'), [
    '### Q: Why do system prompts carry more weight than user prompts?',
  ])
  assert.deepEqual(untranslatedHeadings('### Q: 为什么 System Prompt 比 User Prompt 权重更高？'), [])
  assert.deepEqual(untranslatedHeadings('```python\n# This is a code comment that must remain in English\n```'), [])
})
