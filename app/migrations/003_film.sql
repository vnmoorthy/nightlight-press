-- Animated pages: short clips made from the painted pages after a book is bound.
alter table pages add column if not exists video_media_id text;
alter table books add column if not exists cover_video_media_id text;
