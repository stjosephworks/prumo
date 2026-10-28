import { Migration } from '@mikro-orm/migrations';

export class Migration20261005111548_add_user_phone extends Migration {

  override name = 'Migration20261005111548_add_user_phone';

  override up(): void | Promise<void> {
    this.addSql(`alter table "user" alter column "email" drop not null;`);
    this.addSql(`alter table "user" add column "phone" text null, add column "phone_verified_at" timestamptz null;`);
    this.addSql(`alter table "user" add constraint "user_phone_unique" unique ("phone");`);
    this.addSql(`alter table "user" add constraint "user_email_or_phone_check" check ("email" is not null or "phone" is not null);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "user" drop constraint "user_email_or_phone_check";`);
    this.addSql(`alter table "user" drop constraint "user_phone_unique";`);
    this.addSql(`alter table "user" drop column "phone", drop column "phone_verified_at";`);
    this.addSql(`alter table "user" alter column "email" set not null;`);
  }

}
