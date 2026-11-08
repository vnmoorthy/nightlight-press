-- Stories told out loud (on stage or at home) become books; an opt-in, disclosed robot sidekick.
alter table orders add column if not exists told_text text;
alter table orders add column if not exists teller_name text;
alter table orders add column if not exists robot boolean not null default false;
