import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const temp = mkdtempSync(join(tmpdir(), 'hl-package-'))
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', ...options })
try {
  const packed = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temp]))[0]
  const tarball = join(temp, packed.filename)
  for (const file of ['dist/index.js', 'dist/core/index.js', 'api-manifest.json'])
    assert(packed.files.some(f => f.path === file), `Missing ${file}`)
  const prefix = join(temp, 'install')
  run('npm', ['install', '--prefix', prefix, '--no-audit', '--no-fund', tarball], { stdio: ['ignore', 'pipe', 'inherit'] })
  const cli = join(prefix, 'node_modules/hyperliquid-cli/dist/index.js')
  const env = { ...process.env, HL_HOME: join(temp, 'home'), HYPERLIQUID_PRIVATE_KEY: '', HYPERLIQUID_WALLET_ADDRESS: '' }
  const hl = (...args) => run(process.execPath, [cli, ...args], { cwd: temp, env })
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  assert.equal(hl('--version').trim(), pkg.version)
  assert.match(hl('ws', 'l2', '--help'), /--coin/)
  assert.match(hl('info', 'allMids', '--dry-run'), /ALL_DEXS/)
  hl('account', 'add', '--alias', 'smoke', '--user', '0x0000000000000000000000000000000000000001')
  assert.match(hl('account', 'ls'), /smoke/)
  console.log(`Installed package smoke test passed: ${packed.filename}`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tarball=${tarball}\n`)
} finally {
  if (!process.env.GITHUB_OUTPUT) rmSync(temp, { recursive: true, force: true })
}
