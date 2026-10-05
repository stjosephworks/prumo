import { Migration } from '@mikro-orm/migrations';

export class Migration20261005111547_create_authorization extends Migration {

  override name = 'Migration20261005111547_create_authorization';

  override up(): void | Promise<void> {
    this.addSql(`create table "authorization" ("id" uuid not null default uuidv7(), "client_id" text not null, "client_name" text not null, "redirect_uri" text not null, "code_challenge" text not null, "client_state" text null, "resource" text not null, "scope" text not null, "status" text not null, "user_id" uuid null, "code_hash" text null, "session_id" uuid null, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`);
    this.addSql(`create index "authorization_user_id_index" on "authorization" ("user_id");`);

    this.addSql(`alter table "authorization" add constraint "authorization_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete cascade;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "authorization" cascade;`);
  }

}
