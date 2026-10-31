-- Stage 22: what parents send back on Telegram. `done` is a tap on the "हो गया 👍" button under a voice note
-- (`message_id` says which); `text` and `voice` are replies. A voice reply's audio is in the private
-- `parent-media` bucket (`file`), with a transcript for Hindi-home children.
create table parent_replies (
  id uuid primary key,
  child_id uuid not null references children on delete cascade,
  message_id uuid references parent_messages on delete set null,
  received_at timestamptz not null,
  type text not null check (type in ('done', 'text', 'voice')),
  text text,
  file text,
  transcript text
);

alter table parent_replies enable row level security;

insert into storage.buckets (id, name, public)
values ('parent-media', 'parent-media', false)
on conflict (id) do nothing;
