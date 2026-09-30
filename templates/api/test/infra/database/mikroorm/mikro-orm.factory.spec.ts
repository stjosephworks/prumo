import { testOrm } from '@test/support/setup'
import { describe, expect, it } from 'vitest'

describe('createOrmConfig', () => {
  it('finds nothing to change once migrated, and leaves Better Auth’s schema alone', async () => {
    await expect(testOrm().schema.getUpdateSchemaSQL({ wrap: false })).resolves.toBe('')
  })
})
