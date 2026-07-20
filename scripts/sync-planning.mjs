/** 解析 git diff --name-status -M，保留新增、修改、删除和重命名语义。 */
export function parseNameStatus(output, stateFiles = {}, currentBlobs = {}) {
  return output.split('\n').filter(Boolean).map((line) => {
    const [status, oldPath, renamedPath] = line.split('\t')
    const path = renamedPath ?? oldPath
    const metadata = stateFiles[oldPath]
    return {
      status,
      old_path: oldPath,
      path,
      community_edited: Boolean(metadata && currentBlobs[oldPath] && currentBlobs[oldPath] !== metadata.translation_blob),
    }
  })
}

/** 将 Git 祖先关系归一为同步状态；非快进历史必须停止。 */
export function classifyHistory(baseCommit, upstreamCommit, isAncestor) {
  if (!isAncestor) return { status: 'blocked', reason: 'upstream-non-fast-forward' }
  if (baseCommit === upstreamCommit) return { status: 'current' }
  return { status: 'updates-available' }
}

/** 为阻塞报告选择唯一 Issue，并标出历史重复项。 */
export function planBlockedIssue(openIssues) {
  const matching = openIssues
    .filter((issue) => issue.title === '[sync] upstream-sync-blocked')
    .sort((left, right) => left.number - right.number)
  if (matching.length === 0) return { action: 'create', duplicate_numbers: [] }
  return {
    action: 'update',
    issue_number: matching[0].number,
    duplicate_numbers: matching.slice(1).map((issue) => issue.number),
  }
}
