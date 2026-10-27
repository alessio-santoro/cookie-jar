import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runBrowserSpike } from '../server/browser-spike.js'

async function directoryBytes(path) {
  let bytes = 0
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name)
    bytes += entry.isDirectory() ? await directoryBytes(child) : (await stat(child)).size
  }
  return bytes
}

try {
  const dependencies = {}
  for (const name of ['@sparticuz/chromium', 'playwright-core']) {
    const root = new URL(`../node_modules/${name}/`, import.meta.url)
    const metadata = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
    dependencies[name] = {
      version: metadata.version,
      installedBytes: await directoryBytes(fileURLToPath(root)),
    }
  }
  const runs = []
  for (const invocation of ['first-in-process', 'repeat-in-process']) {
    const result = { invocation, ...await runBrowserSpike() }
    result.serializedResultBytes = Buffer.byteLength(JSON.stringify(result))
    runs.push(result)
  }
  console.log(JSON.stringify({
    measuredAt: new Date().toISOString(),
    platform: `${process.platform}/${process.arch}`,
    nodeVersion: process.version,
    dependencies,
    vercel: {
      verified: false,
      functionBundleBytes: null,
      plan: null,
      coldWarmInvocations: 'not measured',
    },
    runs,
    limitations: [
      'A loopback HTTP fixture is created and owned by this CLI, not an arbitrary target.',
      'First/repeat runs are not Vercel cold/warm invocation measurements.',
      'Executable extraction can reuse files from previous processes in the OS temporary directory.',
      'Memory samples cover Node and the browser parent separately, not total browser-tree peak memory.',
      'Dependency directory sizes are not the deployed function bundle size.',
      'serializedResultBytes measures each run before its size field, not an HTTP response.',
      'Network enforcement, sandbox isolation and public deployment readiness are not verified.',
    ],
  }, null, 2))
} catch (error) {
  console.error(JSON.stringify({
    code: 'BROWSER_SPIKE_FAILED',
    message: 'Local browser fixture verification failed.',
    diagnostic: error.message,
  }))
  process.exitCode = 1
}
