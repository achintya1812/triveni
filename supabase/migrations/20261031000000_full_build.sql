-- Stage 9: the full build's tables. Applies to the full-build project only; the MVP's project stays as it is.
-- Fields match packages/core/src/records.ts. RLS is on with no policies, as before: only the API can read or write.

alter table children
  add column parent_chat_id text,
  add column parent_opt_in_at timestamptz,
  add column hindi_understanding text check (hindi_understanding in ('well', 'some', 'none'));

alter table lessons
  add column source text not null default 'dropdown' check (source in ('dropdown', 'voice')),
  add column transcript text,
  add column page int;

-- Row n on the slate asks question_ids[n]; child_ids lists the children in a re-check (null for the whole class).
alter table checks
  drop column concept_id,
  add column question_ids text[] not null check (cardinality(question_ids) between 1 and 2),
  add column kind text not null check (kind in ('weekly', 'recheck')),
  add column version_order text[] not null check (cardinality(version_order) = 3 and version_order @> '{A,B,C}'),
  add column child_ids uuid[];

-- A check can have two rows (concepts), so the row joins the key.
alter table answers
  add column "row" int not null default 1 check ("row" in (1, 2)),
  add column cause text,
  drop constraint answers_pkey,
  add primary key (check_id, child_id, "row", version);

create table probe_results (
  id uuid primary key,
  class_id uuid not null references classes on delete cascade,
  child_id uuid not null references children on delete cascade,
  concept_id text not null,
  date date not null,
  passed_at_once boolean not null,
  restart_concept_id text,
  form text check (form in ('concrete', 'pictorial', 'abstract'))
);

create table listening_results (
  class_id uuid not null references classes on delete cascade,
  child_id uuid not null references children on delete cascade,
  date date not null,
  item_id text not null,
  language text not null check (language in ('hindi', 'bhili')),
  value int,
  status text not null check (status in ('right', 'wrong', 'no_data')),
  primary key (child_id, item_id, language)
);

create table parent_messages (
  id uuid primary key,
  class_id uuid not null references classes on delete cascade,
  child_id uuid not null references children on delete cascade,
  kind text not null check (kind in ('catch_up', 'activity')),
  concept_id text not null,
  file text not null,
  status text not null check (status in ('queued', 'sent', 'failed')),
  telegram_message_id bigint,
  sent_at timestamptz
);

alter table probe_results enable row level security;
alter table listening_results enable row level security;
alter table parent_messages enable row level security;

-- `audio` is public (cached speech and the B clips); `voice-notes` is private (the teacher's recordings).
insert into storage.buckets (id, name, public)
values ('audio', 'audio', true), ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;
