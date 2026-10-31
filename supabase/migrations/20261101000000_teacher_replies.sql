-- The teacher's replies to parents on Telegram: a third kind of parent message, with the text it says, or a
-- voice note in the private `parent-media` bucket (`file`). A reply has no concept, and a text reply no file.
alter table parent_messages drop constraint parent_messages_kind_check;
alter table parent_messages add constraint parent_messages_kind_check check (kind in ('catch_up', 'activity', 'reply'));
alter table parent_messages alter column concept_id drop not null;
alter table parent_messages alter column file drop not null;
alter table parent_messages add column text text;
