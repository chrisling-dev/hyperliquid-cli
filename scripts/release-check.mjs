import { readFileSync, appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const beta = /^1\.0\.0-beta\.[1-9]\d*$/.test(version)
const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
if (!beta && !stable) throw new Error('Expected a stable version or 1.0.0-beta.N')
if (event.release?.tag_name !== `v${version}`) throw new Error('Release tag must match package.json version')
if (event.release.prerelease !== beta) throw new Error('Beta releases must be marked prerelease; stable releases must not')
const branch = beta ? 'v1' : 'main'
execFileSync('git', ['fetch', 'origin', branch])
execFileSync('git', ['merge-base', '--is-ancestor', 'HEAD', `origin/${branch}`])
appendFileSync(process.env.GITHUB_OUTPUT, `npm_tag=${beta ? 'beta' : 'latest'}\n`)
console.log(`Validated v${version} from ${branch}`)
