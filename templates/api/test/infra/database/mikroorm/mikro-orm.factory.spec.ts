import { testOrm } from '@test/support/setup'
import { describe, expect, it } from 'vitest'

describe('createOrmConfig', () => {
  it('finds nothing to change once migrated', async () => {
    await expect(testOrm().schema.getUpdateSchemaSQL({ wrap: false })).resolves.toBe('')
  })
})
