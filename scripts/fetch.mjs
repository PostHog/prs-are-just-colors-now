import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const dataFile = new URL('../data/prs.json', import.meta.url)

export function normalize(pr) {
  return {
    number: pr.number,
    author: pr.user?.login || 'ghost',
    bot: pr.user?.type === 'Bot',
    state: pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : pr.draft ? 'draft' : 'open',
    title: pr.title,
  }
}

export async function collect(existing, request, fetched = new Date().toISOString(), full = false) {
  const incremental = !full && existing?.complete && Number.isFinite(Date.parse(existing.fetched))
  const cutoff = incremental ? Date.parse(existing.fetched) - 60_000 : 0
  const prs = new Map(incremental ? existing.prs.map(pr => [pr.number, pr]) : [])
  const sort = incremental ? 'updated' : 'created'
  for (let page = 1; ; page++) {
    const rows = await request(`https://api.github.com/repos/PostHog/posthog/pulls?state=all&sort=${sort}&direction=desc&per_page=100&page=${page}`)
    if (!Array.isArray(rows)) throw new Error('GitHub did not return a PR list')
    let done = rows.length === 0
    for (const pr of rows) {
      if (!Number.isInteger(pr.number) || !Number.isFinite(Date.parse(pr.updated_at))) throw new Error('GitHub returned an invalid PR')
      if (incremental && Date.parse(pr.updated_at) < cutoff) { done = true; continue }
      if (!incremental && pr.number < 100000) { done = true; continue }
      if (pr.number >= 100000 && pr.number <= 999999) prs.set(pr.number, normalize(pr))
    }
    if (done || rows.length < 100) break
  }
  const records = [...prs.values()].sort((a, b) => a.number - b.number)
  if (!records.length || (existing?.complete && records.length < existing.prs.length)) throw new Error('Refusing to replace the snapshot with incomplete data')
  return { fetched, complete: true, prs: records }
}

export function serialize(snapshot) {
  return `{"fetched":${JSON.stringify(snapshot.fetched)},"complete":true,"prs":[\n${snapshot.prs.map(pr => JSON.stringify(pr)).join(',\n')}\n]}\n`
}

async function main() {
  let existing
  try { existing = JSON.parse(await readFile(dataFile, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  const request = async url => {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        signal: AbortSignal.timeout(30_000),
      })
      if (response.ok) return response.json()
      if (attempt >= 3 || (response.status < 500 && response.status !== 429)) throw new Error(`GitHub returned HTTP ${response.status}; snapshot left untouched`)
      await delay(Math.min(60, Number(response.headers.get('retry-after')) || 2 ** attempt) * 1000)
    }
  }
  const snapshot = await collect(existing, request, new Date().toISOString(), process.argv.includes('--full'))
  if (JSON.stringify(snapshot.prs) === JSON.stringify(existing?.prs)) { console.log('PR data unchanged'); return }
  await writeFile(dataFile, serialize(snapshot))
  console.log(`Updated ${snapshot.prs.length} six-digit PRs through #${snapshot.prs.at(-1).number}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
