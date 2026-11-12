import { readFileSync } from 'node:fs'
const marker = '<!-- hyperliquid-cli:api-audit -->'
const title = 'Hyperliquid API audit needs attention'

export default async function syncAuditIssue({ github, context, outcome, reportPath = 'api-audit-report.json' }) {
  let report
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'))
    if (!['covered', 'outdated', 'review-required', 'inconclusive'].includes(report.status) ||
      !['missing', 'missingFields', 'changed', 'changedPages', 'removed', 'errors'].every(k => Array.isArray(report[k]))) {
      report = undefined
    }
  } catch { /* A failed fetch/parser can leave an empty report. */ }
  const healthy = outcome === 'success' && report?.status === 'covered' &&
    ['missing', 'missingFields', 'changed', 'changedPages', 'removed', 'errors'].every(k => report[k].length === 0)
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...context.repo, state: 'all', per_page: 100, sort: 'created', direction: 'desc',
    creator: 'github-actions[bot]',
  })
  // Marker and creator identify our issue even if its title is edited.
  const matching = issues.filter(i => !i.pull_request && i.body?.includes(marker))
  const open = matching.filter(i => i.state === 'open')
  if (healthy) {
    for (const issue of open) await github.rest.issues.update({
      ...context.repo, issue_number: issue.number, state: 'closed', state_reason: 'completed',
    })
    return
  }
  const run = `${context.serverUrl || 'https://github.com'}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`
  const sections = report ? ['missing', 'missingFields', 'changed', 'changedPages', 'removed', 'errors']
    .filter(k => report[k].length)
    .map(k => `### ${k}\n\n\`\`\`json\n${JSON.stringify(report[k], null, 2).slice(0, 5000)}\n\`\`\``).join('\n\n') :
    'The audit did not produce a valid report. Inspect the run logs for fetch, parser, or execution errors.'
  const body = `${marker}\nThe Hyperliquid API audit needs attention.\n\nStatus: **${report?.status === 'covered' ? 'execution failed' : report?.status || 'execution failed'}**\n\n[Latest workflow run and report artifacts](${run})\n\n${sections}\n\nReview upstream changes, update mappings where needed, and refresh the reviewed snapshot deliberately. A successful audit closes this issue; future failures reopen it. Long lists may be truncated above; download the full JSON artifact.`
  const existing = open[0] || matching[0]
  if (existing) {
    await github.rest.issues.update({ ...context.repo, issue_number: existing.number, title, body, state: 'open' })
  } else {
    await github.rest.issues.create({ ...context.repo, title, body })
  }
  // Recover from any pre-existing duplicates as well as preventing new ones.
  for (const duplicate of open.slice(1)) await github.rest.issues.update({
    ...context.repo, issue_number: duplicate.number, state: 'closed', state_reason: 'not_planned',
  })
}
