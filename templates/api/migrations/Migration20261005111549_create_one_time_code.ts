import { Migration } from '@mikro-orm/migrations';

export class Migration20261005111549_create_one_time_code extends Migration {

  override name = 'Migration20261005111549_create_one_time_code';

  override up(): void | Promise<void> {
    this.addSql(`create table "one_time_code" ("id" uuid not null default uuidv7(), "channel" text not null, "destination" text not null, "purpose" text not null, "user_id" uuid null, "code_hash" text not null, "attempts_left" int not null, "expires_at" timestamptz not null, "last_sent_at" timestamptz not null, "hour_started_at" timestamptz not null, "sent_this_hour" int not null, "day_started_at" timestamptz not null, "sent_today" int not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`);
    this.addSql(`alter table "one_time_code" add constraint "one_time_code_channel_destination_purpose_unique" unique ("channel", "destination", "purpose");`);
    this.addSql(`alter table "one_time_code" add constraint "one_time_code_channel_check" check ("channel" in ('email', 'phone'));`);
    this.addSql(`alter table "one_time_code" add constraint "one_time_code_purpose_check" check ("purpose" in ('verify-email', 'reset-password', 'sign-in', 'change-email', 'change-phone'));`);
    this.addSql(`create index "one_time_code_expires_at_index" on "one_time_code" ("expires_at");`);
    this.addSql(`alter table "one_time_code" add constraint "one_time_code_user_id_foreign" foreign key ("user_id") references "user" ("id") on delete cascade;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "one_time_code" cascade;`);
  }

}
