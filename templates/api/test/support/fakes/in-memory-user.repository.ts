import type { User } from '@/domain/auth/entities/user.entity'
import type { UserRepository } from '@/domain/auth/repositories/user.repository'

export class InMemoryUserRepository implements UserRepository {
  readonly rows = new Map<string, User>()

  async findById(id: string): Promise<User | null> {
    return this.rows.get(id) ?? null
  }

  async findByEmail(email: string): Promise<User | null> {
    return [...this.rows.values()].find((user) => user.email === email) ?? null
  }

  // prumo:phone-code
  async findByPhone(phone: string): Promise<User | null> {
    return [...this.rows.values()].find((user) => user.phone === phone) ?? null
  }
  // prumo:end-phone-code

  async delete(userId: string): Promise<void> {
    this.rows.delete(userId)
  }

  async save(user: User): Promise<void> {
    // The database assigns the id; here the first save does.
    user.id ??= crypto.randomUUID()
    this.rows.set(user.id, user)
  }
}
