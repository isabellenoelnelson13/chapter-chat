-- Run this in the Supabase SQL editor to wipe all app data.
-- Profiles (auth users) are preserved.

TRUNCATE TABLE reading_sessions   CASCADE;
TRUNCATE TABLE activity_events    CASCADE;
TRUNCATE TABLE notifications      CASCADE;
TRUNCATE TABLE club_posts         CASCADE;
TRUNCATE TABLE club_members       CASCADE;
TRUNCATE TABLE clubs              CASCADE;
TRUNCATE TABLE follows            CASCADE;
TRUNCATE TABLE follow_requests    CASCADE;
TRUNCATE TABLE user_books         CASCADE;
TRUNCATE TABLE book_reviews       CASCADE;
TRUNCATE TABLE authors            CASCADE;
TRUNCATE TABLE books              CASCADE;
