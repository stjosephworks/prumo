import { execFileSync } from 'node:child_process'

function insideRepository() {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' })
    return true
  } catch (error) {
    // No git, or no repository: an install from an archive or inside a container, where hooks have no use.
    if (error.code === 'ENOENT' || error.status === 128) {
      return false
    }
    throw error
  }
}

if (insideRepository()) {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' })
}
