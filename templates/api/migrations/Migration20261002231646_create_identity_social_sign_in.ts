import { Migration } from '@mikro-orm/migrations';

export class Migration20261002231646_create_identity_social_sign_in extends Migration {

  override name = 'Migration20261002231646_create_identity_social_sign_in';

  override up(): void | Promise<void> {
    this.addSql(`create table "social_sign_in" ("id" uuid not null default uuidv7(), "provider" text not null, "client" text not null, "return_to" text not null, "browser_hash" text not null, "code_verifier" text null, "nonce" text not null, "status" text not null, "user_id" uuid null, "exchange_hash" text null, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`);
    this.addSql(`create index "social_sign_in_user_id_index" on "social_sign_in" ("user_id");`);

    this.addSql(`create table "identity" ("id" uuid not null default uuidv7(), "user_id" uuid not null, "provider" text not null, "subject" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`);
    this.addSql(`create index "identity_user_id_index" on "identity" ("user_id");`);
    this.addSql(`alter table "identity" add constraint "identity_provider_subject_unique" unique ("provider", "subject");`);

    this.addSql(`alter table "social_sign_in" add constraint "social_sign_in_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete cascade;`);

    this.addSql(`alter table "identity" add constraint "identity_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete cascade;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "social_sign_in" cascade;`);
    this.addSql(`drop table if exists "identity" cascade;`);
  }

}
