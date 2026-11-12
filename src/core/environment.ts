// Core only handles subscriptions. Do not retain wallet keys, cloud credentials,
// npm tokens, or executable NODE_OPTIONS from its short-lived parent process.
export function coreEnvironment(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const allowed = new Set([
    "PATH", "HOME", "USERPROFILE", "SystemRoot", "SYSTEMROOT", "WINDIR",
    "TMPDIR", "TMP", "TEMP", "HL_HOME", "LANG", "LC_ALL", "TZ",
    "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
    "http_proxy", "https_proxy", "all_proxy", "no_proxy",
    "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR",
  ])
  return Object.fromEntries(Object.entries(env).filter(([key]) => allowed.has(key)))
}
