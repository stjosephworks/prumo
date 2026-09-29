export interface TransactionManager {
  run<T>(work: () => Promise<T>): Promise<T>
}

export const TRANSACTION_MANAGER = Symbol('TransactionManager')
