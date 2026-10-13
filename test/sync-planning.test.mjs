import assert from 'node:assert/strict'
import test from 'node:test'
import { applyLocalizedPatches, classifyHistory, headingRanges, headingSpan, includePriorSectionForHeadingInsertion, mapPatchHunks, overlappingPatchGroups, parseNameStatus, parseUnifiedDiff, preservesInsertionAnchor, questionSections, restoreInsertionAnchor, upsertQuestionSections } from '../scripts/sync-planning.mjs'

test('分类新增、修改、删除和重命名', () => {
  const changes = parseNameStatus('A\tnew.md\nM\tedit.md\nD\told.md\nR100\tbefore.md\tafter.md')
  assert.deepEqual(changes.map(({ status, old_path, path }) => ({ status, old_path, path })), [
    { status: 'A', old_path: 'new.md', path: 'new.md' },
    { status: 'M', old_path: 'edit.md', path: 'edit.md' },
    { status: 'D', old_path: 'old.md', path: 'old.md' },
    { status: 'R100', old_path: 'before.md', path: 'after.md' },
  ])
})

test('识别同步基线后的社区修正', () => {
  const [change] = parseNameStatus(
    'M\tedit.md',
    { 'edit.md': { translation_blob: 'old-blob' } },
    { 'edit.md': 'community-blob' },
  )
  assert.equal(change.community_edited, true)
})

test('上游同步基线不是新提交祖先时停止', () => {
  assert.deepEqual(classifyHistory('base', 'rewritten', false), {
    status: 'blocked',
    reason: 'upstream-non-fast-forward',
  })
})

test('解析 Git 零上下文差异并保留每个 hunk 的变更行', () => {
  const diff = [
    'diff --git a/doc.md b/doc.md',
    '--- a/doc.md',
    '+++ b/doc.md',
    '@@ -2,2 +2 @@',
    '-old first',
    '-old second',
    '+new first',
    ' context line that keeps the same hunk',
    '@@ -8 +7,2 @@',
    '+added one',
    '+added two',
  ].join('\n')
  assert.deepEqual(parseUnifiedDiff(diff), [
    { oldStart: 2, oldCount: 2, newStart: 2, newCount: 1, before: ['old first', 'old second'], after: ['new first'] },
    { oldStart: 8, oldCount: 1, newStart: 7, newCount: 2, before: [], after: ['added one', 'added two'] },
  ])
})

test('分组补丁把局部 hunk 序号映射回稳定文件序号', () => {
  const payload = { patches: [{ hunk: 0, find: '锚点', replace: '译文' }, { hunk: 2, find: '未映射', replace: '' }] }
  assert.deepEqual(mapPatchHunks(payload, [{ id: 51 }, { id: 64 }]), {
    patches: [{ hunk: 51, find: '锚点', replace: '译文' }, { hunk: 2, find: '未映射', replace: '' }],
  })
})

test('合并补丁把多个局部 hunk 序号映射回稳定文件序号', () => {
  assert.deepEqual(mapPatchHunks({ patches: [{ hunks: [0, 2], find: '锚点', replace: '译文' }] }, [{ id: 51 }, { id: 64 }, { id: 72 }]), {
    patches: [{ hunks: [51, 72], find: '锚点', replace: '译文' }],
  })
})

test('识别并合并指向同一中文文本的补丁组', () => {
  const markdown = '旧公告段落。\n\nGemini 表格行。\n'
  assert.deepEqual(overlappingPatchGroups(markdown, [
    { hunk: 2, find: '旧公告段落。', replace: '十月公告。' },
    { hunk: 3, find: '旧公告段落。', replace: '八月公告。' },
    { hunk: 4, find: 'Gemini 表格行。', replace: '新模型表格行。' },
  ]), [[2, 3]])
})

test('localized patches replace only one unique Markdown slice', () => {
  const original = '# Title\n\nKeep this paragraph.\n\nOld text.\n\nTail.\n'
  const patched = applyLocalizedPatches(original, [{ hunk: 0, find: 'Old text.', replace: '新文本。' }], 1)
  assert.equal(patched, '# Title\n\nKeep this paragraph.\n\n新文本。\n\nTail.\n')
  assert.equal(applyLocalizedPatches(original, [{ hunk: 0, find: 'Old text', replace: 'New text' }], 1),
    '# Title\n\nKeep this paragraph.\n\nNew text.\n\nTail.\n')
})

test('localized patches reject ambiguous anchors and missing hunk coverage', () => {
  const original = '重复段落。\n\n重复段落。\n'
  assert.throws(() => applyLocalizedPatches(original, [{ hunk: 0, find: '重复段落。', replace: '已改写。' }], 1), /不存在或不唯一/)
  assert.throws(() => applyLocalizedPatches(original, [], 1), /补丁未覆盖所有上游变更块/)
})

test('one source hunk can update multiple exact table rows', () => {
  const original = '| 岗位 | 薪酬 |\n|---|---|\n| A | $10 |\n| B | $20 |\n'
  const patched = applyLocalizedPatches(original, [
    { hunk: 0, find: '| A | $10 |', replace: '| A | $12 |' },
    { hunk: 0, find: '| B | $20 |', replace: '| B | $22 |' },
  ], 1)
  assert.equal(patched, '| 岗位 | 薪酬 |\n|---|---|\n| A | $12 |\n| B | $22 |\n')
})

test('localized patches accept a complete fenced code block without blank-line separators', () => {
  const original = '代码说明：\n```python\nx = 1\n```\n后续说明。\n'
  const patched = applyLocalizedPatches(original, [{
    hunk: 0,
    find: '```python\nx = 1\n```',
    replace: '```python\nx = 2\n```',
  }], 1)
  assert.equal(patched, '代码说明：\n```python\nx = 2\n```\n后续说明。\n')
})

test('localized patches support globally numbered hunks from split contexts', () => {
  assert.equal(applyLocalizedPatches('段落 A。\n\n段落 B。\n', [
    { hunk: 9, find: '段落 A。', replace: '段落甲。' },
    { hunk: 12, find: '段落 B。', replace: '段落乙。' },
  ], [9, 12]), '段落甲。\n\n段落乙。\n')
})

test('one non-overlapping merged patch can cover multiple source hunks', () => {
  assert.equal(applyLocalizedPatches('旧公告。\n\n七月公告。\n', [
    { hunks: [2, 3], find: '旧公告。', replace: '十月公告。\n\n八月公告。' },
    { hunk: 3, find: '七月公告。', replace: '更新后的七月公告。' },
  ], [2, 3]), '十月公告。\n\n八月公告。\n\n更新后的七月公告。\n')
})

test('localized patches allow one exact code line when the whole block validator guards it', () => {
  const original = '说明。\n```python\nx = 1\ny = 2\n```\n'
  assert.equal(applyLocalizedPatches(original, [{ hunk: 0, find: 'x = 1', replace: 'x = 3' }], 1),
    '说明。\n```python\nx = 3\ny = 2\n```\n')
})

test('localized patches allow a hunk beginning at a fenced block opener', () => {
  const original = '说明：\n```python\nx = 1\ny = 2\n```\n'
  assert.equal(applyLocalizedPatches(original, [{
    hunk: 0,
    find: '```python\nx = 1',
    replace: '```python\nx = 3',
  }], 1), '说明：\n```python\nx = 3\ny = 2\n```\n')
})

test('localized patches align a code block when the mirror omitted its language label', () => {
  const original = '计算：\n```\n= ~10.7 GB per request\n```\n'
  assert.equal(applyLocalizedPatches(original, [{
    hunk: 0,
    find: '```text\n= ~10.7 GB per request',
    replace: '```text\n= ~21.5 GB per request',
  }], 1), '计算：\n```text\n= ~21.5 GB per request\n```\n')
})

test('localized patches deduplicate one fence variant across unrelated code blocks', () => {
  const original = [
    '### 问题',
    '```',
    'target code',
    '```',
    '',
    '另一段代码：',
    '```',
    'different code',
    '```',
  ].join('\n')
  const section = headingRanges(original)[1]
  assert.equal(applyLocalizedPatches(original, [{
    hunk: 0,
    find: '```text\ntarget code\n```',
    replace: '```text\nupdated code\n```',
  }], 1, { 0: section }), [
    '### 问题',
    '```text',
    'updated code',
    '```',
    '',
    '另一段代码：',
    '```',
    'different code',
    '```',
  ].join('\n'))
})

test('question section parsing ignores Q headings inside fenced code', () => {
  const markdown = '### Q1: first\n\n```md\n### Q9: example\n```\n\nbody\n\n### Q2: second\ntext\n\n## Key Takeaways\n'
  assert.deepEqual(questionSections(markdown).map(({ id, text }) => ({ id, text })), [
    { id: 1, text: '### Q1: first\n\n```md\n### Q9: example\n```\n\nbody' },
    { id: 2, text: '### Q2: second\ntext' },
  ])
})

test('question upsert inserts ordered blocks and replaces a reviewed block', () => {
  const original = '### Q1: first\nold\n\n## 关键要点\nkeep\n'
  const inserted = upsertQuestionSections(original, ['### Q3: third\nthird', '### Q2: second\nsecond'])
  assert.equal(inserted, '### Q1: first\nold\n\n### Q2: second\nsecond\n\n### Q3: third\nthird\n\n## 关键要点\nkeep\n')
  assert.equal(upsertQuestionSections(inserted, ['### Q2: 第二题\n修订']),
    '### Q1: first\nold\n\n### Q2: 第二题\n修订\n\n### Q3: third\nthird\n\n## 关键要点\nkeep\n')
})

test('localized patches disambiguate repeated code blocks within the matching heading section', () => {
  const original = [
    '## First question',
    '```text',
    'same code',
    '```',
    '',
    '## Second question',
    '```text',
    'same code',
    '```',
    '',
  ].join('\n')
  const second = headingRanges(original)[2]
  const updated = applyLocalizedPatches(original, [{
    hunk: 0,
    find: '```text\nsame code\n```',
    replace: '```text\nupdated code\n```',
  }], 1, { 0: second })
  assert.equal(updated, original.replace(
    '## Second question\n```text\nsame code\n```',
    '## Second question\n```text\nupdated code\n```',
  ))
  assert.ok(second.start < second.end)
})

test('localized patches allow an exact multi-line slice inside a fenced diagram', () => {
  const original = '```mermaid\nmindmap\n  root((题库))\n    系统设计场景\n    进阶题组\n```\n'
  assert.equal(applyLocalizedPatches(original, [{
    hunk: 0,
    find: '    系统设计场景\n    进阶题组',
    replace: '    Voice AI\n      双工与流水线\n    系统设计场景\n    进阶题组',
  }], 1), '```mermaid\nmindmap\n  root((题库))\n    Voice AI\n      双工与流水线\n    系统设计场景\n    进阶题组\n```\n')
})

test('localized patches accept a standalone bold paragraph before a code block', () => {
  const original = '说明。\n\n**多提供商回退：**\n```python\nproviders = []\n```\n'
  assert.equal(applyLocalizedPatches(original, [{
    hunk: 0,
    find: '**多提供商回退：**',
    replace: '**生命周期登记表：**\n\n**多提供商回退：**',
  }], 1), '说明。\n\n**生命周期登记表：**\n\n**多提供商回退：**\n```python\nproviders = []\n```\n')
})

test('localized patches accept a paragraph immediately before a Markdown list', () => {
  const original = '回答：\n\n解释适用于：\n- 第一项\n- 第二项\n'
  assert.equal(applyLocalizedPatches(original, [{
    hunk: 0,
    find: '解释适用于：',
    replace: '解释通常适用于：',
  }], 1), '回答：\n\n解释通常适用于：\n- 第一项\n- 第二项\n')
})

test('localized patches ignore trailing Markdown hard-break spaces when matching a line', () => {
  assert.equal(applyLocalizedPatches('**标题：**  \n', [{
    hunk: 0,
    find: '**标题：**',
    replace: '**更新标题：**',
  }], 1), '**更新标题：**  \n')
})

test('heading ranges ignore Markdown-like lines inside fenced code blocks', () => {
  assert.equal(headingRanges('## First\n```python\n# code comment\n```\n## Second').length, 3)
})

test('hunk heading spans include every section touched by its lines', () => {
  const markdown = '## First\na\n## Second\nb\n## Third\nc\n'
  assert.deepEqual(headingSpan(markdown, 2, 3), { first: 1, last: 2 })
})

test('heading insertions before a changed heading include the preceding section', () => {
  const markdown = '## First\na\n## Second\nb\n## Third\nc\n'
  const span = headingSpan(markdown, 5, 1)
  assert.deepEqual(includePriorSectionForHeadingInsertion(span, {
    before: ['## Third'],
    after: ['new preceding content', '', '## Updated Third'],
  }), { first: 2, last: 3 })
  assert.deepEqual(includePriorSectionForHeadingInsertion(span, {
    before: ['## Third'],
    after: ['## Updated Third', 'new section content'],
  }), span)
})

test('insertion anchors may split only at a blank-line boundary', () => {
  assert.equal(preservesInsertionAnchor('existing text\n\n---', 'existing text\n\nnew block\n\n---'), true)
  assert.equal(preservesInsertionAnchor('- existing item', '- existing item\n- new item'), true)
  assert.equal(preservesInsertionAnchor('existing text', 'changed existing text'), false)
})

test('insertion anchors may append a table row without changing the existing row', () => {
  const find = '| 提示词-模型耦合 | 旧风险 | 旧建议 |'
  const replacement = `${find}\n| 未固定的默认值 | 新风险 | 新建议 |`
  assert.equal(preservesInsertionAnchor(find, replacement), true)
  assert.equal(preservesInsertionAnchor(find, `${replacement}\n| 嵌入模型 | 新风险 | 新建议 |`), true)
  assert.equal(preservesInsertionAnchor(find, `| 新增行 | 新风险 | 新建议 |\n${find}`), true)
})

test('restore malformed insertion output by preserving the existing list or table anchor', () => {
  assert.equal(restoreInsertionAnchor('- existing', '- added'), '- existing\n- added')
  assert.equal(restoreInsertionAnchor('| old | row |', '| new | row |'), '| old | row |\n| new | row |')
})
