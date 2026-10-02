import type { TransactionManager } from '@/domain/shared/transactions/transaction-manager'

// Runs the work and nothing else: atomicity is the adapter's to prove, against a real database.
export class ImmediateTransactionManager implements TransactionManager {
  run<T>(work: () => Promise<T>): Promise<T> {
    return work()
  }
}
