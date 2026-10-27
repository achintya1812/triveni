-- MVP tables. IDs are made on the phone (Dexie writes first), so they have no default.
-- RLS is on with no policies: only the API, using the service-role key, can read or write.

create table classes (
  id uuid primary key,
  school text not null,
  grade int not null
);

create table children (
  id uuid primary key,
  class_id uuid not null references classes on delete cascade,
  roll_no int not null,
  name text not null,
  home_language text not null check (home_language in ('hindi', 'bhili')),
  unique (class_id, roll_no)
);

create table attendance (
  class_id uuid not null references classes on delete cascade,
  date date not null,
  child_id uuid not null references children on delete cascade,
  present boolean not null,
  primary key (child_id, date)
);

create table lessons (
  id uuid primary key,
  class_id uuid not null references classes on delete cascade,
  date date not null,
  concept_id text not null
);

create table checks (
  id uuid primary key,
  class_id uuid not null references classes on delete cascade,
  date date not null,
  concept_id text not null
);

create table answers (
  check_id uuid not null references checks on delete cascade,
  child_id uuid not null references children on delete cascade,
  question_id text not null,
  version text not null check (version in ('A', 'B', 'C')),
  value int,
  status text not null check (status in ('right', 'wrong', 'no_data')),
  primary key (check_id, child_id, version)
);

create table audio_clips (
  id text primary key,
  kind text not null check (kind in ('check_b', 'check_c', 'keyword', 'reteach')),
  language text not null check (language in ('hindi', 'bhili')),
  source text not null check (source in ('human', 'bulbul')),
  url text
);

alter table classes enable row level security;
alter table children enable row level security;
alter table attendance enable row level security;
alter table lessons enable row level security;
alter table checks enable row level security;
alter table answers enable row level security;
alter table audio_clips enable row level security;
