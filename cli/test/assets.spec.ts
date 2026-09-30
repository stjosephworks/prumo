import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assetsFor } from '../src/assets.ts'

describe('assetsFor', () => {
  it('reads the repository from source, even when a build left a copy beside it', () => {
    expect(assetsFor('/repo/cli/src')).toEqual({
      templates: join('/repo', 'templates'),
      knowledge: join('/repo', '.prumo-templates'),
    })
  })

  it('reads the package’s own copy when running built', () => {
    expect(assetsFor('/lib/node_modules/@stjoseph/prumo/dist')).toEqual({
      templates: join('/lib/node_modules/@stjoseph/prumo', 'templates'),
      knowledge: join('/lib/node_modules/@stjoseph/prumo', '.prumo-templates'),
    })
  })
})
