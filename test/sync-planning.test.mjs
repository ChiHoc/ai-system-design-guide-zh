import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyHistory, parseNameStatus, planBlockedIssue } from '../scripts/sync-planning.mjs'

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

test('阻塞 Issue 只更新最早一条并识别重复项', () => {
  assert.deepEqual(planBlockedIssue([
    { number: 9, title: '[sync] upstream-sync-blocked' },
    { number: 3, title: '[sync] upstream-sync-blocked' },
    { number: 4, title: '其他问题' },
  ]), {
    action: 'update',
    issue_number: 3,
    duplicate_numbers: [9],
  })
})
