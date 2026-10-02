import { Migration } from '@mikro-orm/migrations';

export class Migration20261002225917_create_email_code extends Migration {

  override name = 'Migration20261002225917_create_email_code';

  override up(): void | Promise<void> {
    this.addSql(`create table "email_code" ("id" uuid not null default uuidv7(), "user_id" uuid not null, "purpose" text not null, "code_hash" text not null, "attempts_left" int not null, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`);
    this.addSql(`alter table "email_code" add constraint "email_code_user_id_purpose_unique" unique ("user_id", "purpose");`);

    this.addSql(`alter table "email_code" add constraint "email_code_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete cascade;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "email_code" cascade;`);
  }

}
