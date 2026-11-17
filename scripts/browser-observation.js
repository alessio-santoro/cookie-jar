import { runBrowserObservation } from '../server/browser-observation.js'

try {
  console.log(JSON.stringify(await runBrowserObservation(), null, 2))
} catch {
  console.error(JSON.stringify({
    code: 'BROWSER_OBSERVATION_FAILED',
    message: 'Local controlled-browser observation failed.',
  }))
  process.exitCode = 1
}
