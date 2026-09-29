import { EntityManager } from '@mikro-orm/postgresql'
import { injectable } from 'tsyringe'
import type { TransactionManager } from '@/domain/shared/transactions/transaction-manager'

@injectable()
export class MikroOrmTransactionManager implements TransactionManager {
  constructor(private readonly em: EntityManager) {}

  // Inside the callback the global EntityManager resolves to the transaction's fork, so every
  // repository that injected it joins the transaction without being handed anything.
  run<T>(work: () => Promise<T>): Promise<T> {
    return this.em.transactional(() => work())
  }
}
