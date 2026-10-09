import { readFile, writeFile, mkdir } from 'node:fs/promises'

const root = path => new URL(`../${path}`, import.meta.url)
const snapshot = JSON.parse(await readFile(root('data/prs.json'), 'utf8'))
const numbers = new Set()
if (!snapshot.complete || !snapshot.prs?.length) throw new Error('Missing complete PR snapshot')
for (const pr of snapshot.prs) {
  if (!Number.isInteger(pr.number) || pr.number < 100000 || pr.number > 999999 || numbers.has(pr.number) || typeof pr.author !== 'string' || typeof pr.title !== 'string' || typeof pr.bot !== 'boolean' || !['open', 'draft', 'closed', 'merged'].includes(pr.state)) throw new Error('Invalid PR snapshot')
  numbers.add(pr.number)
}
const template = await readFile(root('index.html'), 'utf8')
if (template.split('__SNAPSHOT__').length !== 2) throw new Error('Missing snapshot placeholder')
const html = template.replace('__SNAPSHOT__', JSON.stringify(snapshot).replaceAll('<', '\\u003c'))
for (const script of html.matchAll(/<script(?![^>]*type="application\/json")\b[^>]*>([\s\S]*?)<\/script>/g)) new Function(script[1])
await mkdir(root('dist/'), { recursive: true })
await writeFile(root('dist/index.html'), html)
console.log(`Built one HTML file with ${numbers.size} PR colors`)
