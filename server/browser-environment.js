export function createBrowserEnvironment(environment = process.env) {
  return {
    PATH: environment.PATH ?? '',
    HOME: '/tmp',
    TMPDIR: '/tmp',
    LANG: 'en_US.UTF-8',
    LD_LIBRARY_PATH: environment.LD_LIBRARY_PATH ?? '',
  }
}
