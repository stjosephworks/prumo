import { loadEnv } from '@/infra/config/env'
import { createOrmConfig } from './mikro-orm.factory'

export default createOrmConfig(loadEnv())
