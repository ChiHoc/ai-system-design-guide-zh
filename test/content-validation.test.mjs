import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { brokenRelativeLinks, compareStructure, headingShape, missingTranslations, numericTokens, preservesNonMermaidCodeBlocks, untranslatedBlocks, untranslatedHeadings } from '../scripts/content-validation.mjs'

const source = '# Title\n\nValue 42.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x = 1\n```\n\n[Doc](next.md)\n'
const translation = '# 标题\n\n数值 42。\n\n| 甲 | 乙 |\n|---|---|\n| 1 | 2 |\n\n```js\nconst x = 1\n```\n\n[文档](next.md)\n'

test('接受结构一致的译文', () => assert.deepEqual(compareStructure(source, translation), []))
test('外部链接按目标集合比较，重复引用不造成误报', () => {
  assert.deepEqual(compareStructure('[A](https://example.com) [A again](https://example.com)', '[甲](https://example.com)'), [])
})
test('不同单位的十进制金额精确归一化', () => {
  assert.deepEqual(numericTokens('$12.93B'), numericTokens('129.3 亿美元'))
  assert.deepEqual(numericTokens('$1.4T'), numericTokens('1.4 万亿'))
  assert.deepEqual(numericTokens('$1.25M'), numericTokens('125 万'))
  assert.deepEqual(numericTokens('1M'), numericTokens('百万'))
  assert.deepEqual(numericTokens('100k tokens'), numericTokens('10 万 token'))
  assert.deepEqual(numericTokens('1.5m pages'), numericTokens('150 万页'))
  assert.deepEqual(numericTokens('2.4 million'), numericTokens('2.4 百万'))
  assert.deepEqual(numericTokens('10 billion'), numericTokens('10 十亿'))
  assert.deepEqual(numericTokens('1,000 pages'), numericTokens('每千页'))
  assert.deepEqual(numericTokens('1,000'), numericTokens('千'))
  assert.deepEqual(numericTokens('20%'), numericTokens('0.2'))
  assert.deepEqual(numericTokens('50 ms'), numericTokens('50ms'))
  assert.deepEqual(numericTokens('v2.1.284'), numericTokens('v`2.1.284`'))
  assert.deepEqual(numericTokens('2026.08.08'), numericTokens('`2026.08.08`'))
  assert.deepEqual(numericTokens('November 12'), numericTokens('11 月 12 日'))
  assert.deepEqual(numericTokens('May reduces cost'), [])
  assert.deepEqual(numericTokens('May 15'), numericTokens('5 月 15 日'))
  assert.deepEqual(numericTokens('75 percent'), numericTokens('75 百分比'))
  assert.deepEqual(numericTokens('95 percent'), numericTokens('百分之 95'))
  assert.deepEqual(numericTokens('a 70/30 split'), numericTokens('70% and 30%'))
})
test('百分比范围将单位应用到两个端点', () => {
  assert.deepEqual(numericTokens('60-80%'), numericTokens('60%–80%'))
  assert.deepEqual(numericTokens('90–97.5%'), numericTokens('90%-97.5%'))
  assert.deepEqual(numericTokens('70 to 90 percent'), numericTokens('70% 至 90%'))
  assert.deepEqual(numericTokens('65 to 75 percent'), numericTokens('65 到 75 percent'))
  assert.deepEqual(numericTokens('22.9 percent'), numericTokens('22.9%'))
  assert.deepEqual(numericTokens('fell from 29% in 2021 to 10% in 2026'), ['0.1', '0.29', '2021', '2026'])
  assert.deepEqual(numericTokens('rates rose from 24% for Opus 4.7 to 73% for Fable'), ['0.24', '0.73', '4.7'])
})
test('标题层级忽略代码围栏中的 Markdown 示例', () => {
  assert.deepEqual(headingShape('# Title\n\n```md\n## Example\n```\n\n## Section\n'), [1, 2])
})
test('数字检查忽略代码和链接 URL，但保留链接标题中的数字', () => {
  assert.deepEqual(numericTokens('正文 2026，参考 [报告 2026](https://example.com/report-2025)，示例\n```js\nconst x = 2024\n```'), ['2026'])
})
test('检测代码块变化', () => assert.ok(compareStructure(source, translation.replace('const x = 1', 'const x = 2')).includes('非 Mermaid 代码块')))
test('代码块校验忽略仅行尾空格变化', () => assert.equal(preservesNonMermaidCodeBlocks('```text\nline  \n```', '```text\nline\n```'), true))
test('检测 Mermaid 拓扑变化但允许标签翻译', () => {
  const mermaidSource = '# T\n```mermaid\ngraph LR\nA[User] --> B[Model]\n```\n'
  const translatedLabel = '# 标题\n```mermaid\ngraph LR\nA[用户] --> B[模型]\n```\n'
  assert.deepEqual(compareStructure(mermaidSource, translatedLabel), [])
  assert.deepEqual(compareStructure(
    '```mermaid\nflowchart LR\nA["Request"] --> B{"Safeguard classifier"}\nB -->|"fallbacks: default (beta)"| C["Response"]\n```',
    '```mermaid\nflowchart LR\nA["请求"] --> B{"安全分类器"}\nB -->|"回退：默认（测试版）"| C["响应"]\n```',
  ), [])
  assert.deepEqual(compareStructure(
    '```mermaid\ngraph LR\nA["First line\\nSecond line"] --> B["Response"]\n```',
    '```mermaid\ngraph LR\nA["第一行"] --> B["响应"]\n```',
  ), [])
  assert.ok(compareStructure(mermaidSource, translatedLabel.replace('-->', '---')).includes('Mermaid 结构'))
})
test('检测表格破坏', () => assert.ok(compareStructure(source, translation.replace('| 甲 | 乙 |', '| 甲 |')).includes('表格结构')))
test('表格列计数忽略转义竖线、行内代码和代码围栏', () => {
  const left = '| A | B |\n|---|---|\n| `x|y` | C\\|D |\n\n```text\n| not | a | table |\n```'
  const right = '| 甲 | 乙 |\n|---|---|\n| `x` | 丙\\|丁 |\n\n```text\n| not | a | table |\n```'
  assert.deepEqual(compareStructure(left, right), [])
})
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
