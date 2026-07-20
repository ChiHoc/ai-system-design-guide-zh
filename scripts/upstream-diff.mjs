#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readJson } from './content-validation.mjs'
import { classifyHistory, parseNameStatus } from './sync-planning.mjs'

const state = readJson('translation-state.json')
const upstreamRef = process.argv[2] ?? 'upstream/main'

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

let ancestor = true
try {
  git('merge-base', '--is-ancestor', state.upstream_commit, upstreamRef)
} catch {
  ancestor = false
}
const upstreamCommit = git('rev-parse', upstreamRef)
const history = classifyHistory(state.upstream_commit, upstreamCommit, ancestor)
if (history.status === 'blocked') {
  console.error(JSON.stringify(history))
  process.exit(1)
}

if (history.status === 'current') {
  console.log(JSON.stringify({ status: 'current', upstream_commit: upstreamCommit }))
  process.exit(0)
}

const currentBlobs = Object.fromEntries(Object.keys(state.files)
  .filter((path) => existsSync(path))
  .map((path) => [path, git('hash-object', path)]))
const changes = parseNameStatus(
  git('diff', '--name-status', '-M', state.upstream_commit, upstreamCommit, '--', '*.md', '**/*.md'),
  state.files,
  currentBlobs,
)

console.log(JSON.stringify({
  status: 'updates-available',
  base_commit: state.upstream_commit,
  upstream_commit: upstreamCommit,
  changes,
}, null, 2))
