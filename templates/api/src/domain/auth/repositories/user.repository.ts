import type { User } from '@/domain/auth/entities/user.entity'

export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  findByPhone(phone: string): Promise<User | null> // prumo:phone-code
  save(user: User): Promise<void>
}

export const USER_REPOSITORY = Symbol('UserRepository')
