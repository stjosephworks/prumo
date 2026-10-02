import { Migration } from '@mikro-orm/migrations';

export class Migration20261002210629_create_user_profile_session extends Migration {

  override name = 'Migration20261002210629_create_user_profile_session';

  override up(): void | Promise<void> {
    this.addSql(`create table "user" ("id" uuid not null default uuidv7(), "email" text not null, "password_hash" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`);
    this.addSql(`alter table "user" add constraint "user_email_unique" unique ("email");`);

    this.addSql(`create table "session" ("id" uuid not null default uuidv7(), "user_id" uuid not null, "token_hash" text not null, "client_id" text null, "resource" text null, "previous_token_hash" text null, "rotated_at" timestamptz null, "expires_at" timestamptz not null, "revoked_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`);
    this.addSql(`create index "session_user_id_index" on "session" ("user_id");`);

    this.addSql(`create table "profile" ("id" uuid not null default uuidv7(), "user_id" uuid not null, "display_name" text not null, "locale" text not null default 'en', "timezone" text not null default 'UTC', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`);
    this.addSql(`alter table "profile" add constraint "profile_user_id_unique" unique ("user_id");`);

    this.addSql(`alter table "session" add constraint "session_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete cascade;`);

    this.addSql(`alter table "profile" add constraint "profile_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete restrict;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "session" drop constraint "session_user_id_foreign";`);
    this.addSql(`alter table "profile" drop constraint "profile_user_id_foreign";`);

    this.addSql(`drop table if exists "user" cascade;`);
    this.addSql(`drop table if exists "session" cascade;`);
    this.addSql(`drop table if exists "profile" cascade;`);
  }

}
