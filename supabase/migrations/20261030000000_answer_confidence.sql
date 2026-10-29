-- Stage 7: answers read from slate photos.
-- confidence: Claude's confidence (0 to 1) for a box read from a photo; null when the teacher typed it.
-- reviewed: false only for a photo read the teacher hasn't checked.
alter table answers
  add column confidence real check (confidence between 0 and 1),
  add column reviewed boolean not null default true;
