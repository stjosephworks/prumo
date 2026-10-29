import { EntityManager, LockMode } from '@mikro-orm/postgresql'
import { injectable } from 'tsyringe'
import {
  type CodeChannel,
  type CodePurpose,
  OneTimeCode,
  staleBefore,
} from '@/domain/auth/entities/one-time-code.entity'
import type { OneTimeCodeRepository } from '@/domain/auth/repositories/one-time-code.repository'

@injectable()
export class MikroOrmOneTimeCodeRepository implements OneTimeCodeRepository {
  constructor(private readonly em: EntityManager) {}

  lockFor(
    channel: CodeChannel,
    destination: string,
    purpose: CodePurpose,
  ): Promise<OneTimeCode | null> {
    return this.em.findOne(
      OneTimeCode,
      { channel, destination, purpose },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    )
  }

  async save(code: OneTimeCode): Promise<void> {
    await this.em.persist(code).flush()
  }

  async sweep(now: Date, limit: number): Promise<void> {
    // A DELETE takes no LIMIT in Postgres, so the rows are chosen first; SKIP LOCKED leaves a row another request
    // is using to that request.
    await this.em.getConnection().execute(
      `delete from "one_time_code" where "id" in (
        select "id" from "one_time_code" where "expires_at" < ? and "day_started_at" < ? limit ? for update skip locked
      )`,
      [now, staleBefore(now), limit],
    )
  }
}
