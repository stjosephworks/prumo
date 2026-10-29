import { Migration } from '@mikro-orm/migrations';

export class Migration20261005111546_add_user_password extends Migration {

  override name = 'Migration20261005111546_add_user_password';

  override up(): void | Promise<void> {
    this.addSql(`alter table "user" add column "password_hash" text null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "user" drop column "password_hash";`);
  }

}
