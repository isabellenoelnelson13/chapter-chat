-- ================================================================
-- Chapter Chat · Screenshot Seed Script
-- ================================================================
-- Prerequisites:
--   1. Sign up for a NEW test account through the app
--   2. Supabase Dashboard → Authentication → Users → copy the UUID
--   3. Replace <<YOUR_UUID>> below with that UUID
--   4. Run this entire script in the Supabase SQL Editor
-- ================================================================

DO $$
DECLARE
  me        uuid := '15156ae3-789d-4938-a410-d779ff10eeca';   -- ← paste your test account UUID here
  friend_id uuid := gen_random_uuid();
  club_id   uuid;
  conv_id   uuid;
  sugg_id   uuid;

  -- Books resolved by GoodReads ID (from your imported catalog)
  b_fw   uuid;  -- Fourth Wing         (63219094)
  b_nc   uuid;  -- The Night Circus    (13611052)
  b_wit  uuid;  -- Wait for It         (33288638)
  b_arh  uuid;  -- All Rhodes Lead Here (57605091)
  b_tpm  uuid;  -- The Play Maker      (239602338)
  b_hib  uuid;  -- Home Is Where the Bodies Are (194020321)
  b_fa   uuid;  -- The Fang Arrangement (219597683)
BEGIN

  -- ── 1. Profile ───────────────────────────────────────────────
  UPDATE public.profiles SET
    display_name = 'Isabelle',
    bio          = 'fantasy & romance girlie 📚 crying at fictional characters since 2010',
    yearly_goal  = 52
  WHERE id = me;

  -- ── 2. Resolve book IDs ──────────────────────────────────────
  SELECT id INTO b_fw  FROM public.books WHERE goodreads_id = '63219094';
  SELECT id INTO b_nc  FROM public.books WHERE goodreads_id = '13611052';
  SELECT id INTO b_wit FROM public.books WHERE goodreads_id = '33288638';
  SELECT id INTO b_arh FROM public.books WHERE goodreads_id = '57605091';
  SELECT id INTO b_tpm FROM public.books WHERE goodreads_id = '239602338';
  SELECT id INTO b_hib FROM public.books WHERE goodreads_id = '194020321';
  SELECT id INTO b_fa  FROM public.books WHERE goodreads_id = '219597683';

  -- ── 3. Library ───────────────────────────────────────────────

  -- Currently reading
  IF b_fw IS NOT NULL THEN
    INSERT INTO public.user_books (user_id, book_id, shelf, current_page, format, added_at)
    VALUES (me, b_fw, 'reading', 201, 'physical', now() - interval '14 days')
    ON CONFLICT (user_id, book_id) DO UPDATE SET shelf='reading', current_page=201;
  END IF;

  IF b_fa IS NOT NULL THEN
    INSERT INTO public.user_books (user_id, book_id, shelf, current_page, format, added_at)
    VALUES (me, b_fa, 'reading', 89, 'ebook', now() - interval '5 days')
    ON CONFLICT (user_id, book_id) DO UPDATE SET shelf='reading', current_page=89;
  END IF;

  -- Read with half-star ratings + reviews
  IF b_nc IS NOT NULL THEN
    INSERT INTO public.user_books
      (user_id, book_id, shelf, current_page, rating, review, finished_at, added_at)
    VALUES (me, b_nc, 'read', 387, 4.5,
      'Absolutely magical. Morgenstern builds a world so vivid and enchanting that closing the book felt like leaving a dream. The prose alone is worth the price of admission.',
      now() - interval '30 days', now() - interval '45 days')
    ON CONFLICT (user_id, book_id) DO UPDATE
      SET shelf='read', rating=4.5, review=EXCLUDED.review, finished_at=EXCLUDED.finished_at;
  END IF;

  IF b_wit IS NOT NULL THEN
    INSERT INTO public.user_books
      (user_id, book_id, shelf, current_page, rating, review, finished_at, added_at)
    VALUES (me, b_wit, 'read', 476, 5,
      'Mariana Zapata is a genius. The slow burn was absolutely worth every single page. One of my all-time favorites.',
      now() - interval '60 days', now() - interval '75 days')
    ON CONFLICT (user_id, book_id) DO UPDATE
      SET shelf='read', rating=5, review=EXCLUDED.review, finished_at=EXCLUDED.finished_at;
  END IF;

  IF b_arh IS NOT NULL THEN
    INSERT INTO public.user_books
      (user_id, book_id, shelf, current_page, rating, finished_at, added_at)
    VALUES (me, b_arh, 'read', 350, 4,
      now() - interval '90 days', now() - interval '100 days')
    ON CONFLICT (user_id, book_id) DO UPDATE
      SET shelf='read', rating=4, finished_at=EXCLUDED.finished_at;
  END IF;

  IF b_tpm IS NOT NULL THEN
    INSERT INTO public.user_books
      (user_id, book_id, shelf, current_page, rating, finished_at, added_at)
    VALUES (me, b_tpm, 'read', 320, 3.5,
      now() - interval '15 days', now() - interval '25 days')
    ON CONFLICT (user_id, book_id) DO UPDATE
      SET shelf='read', rating=3.5, finished_at=EXCLUDED.finished_at;
  END IF;

  -- Want to read
  IF b_hib IS NOT NULL THEN
    INSERT INTO public.user_books (user_id, book_id, shelf, current_page, added_at)
    VALUES (me, b_hib, 'want', 0, now() - interval '3 days')
    ON CONFLICT (user_id, book_id) DO UPDATE SET shelf='want';
  END IF;

  -- ── 4. Reading sessions (7-day streak + today's stats) ───────

  IF b_fw IS NOT NULL THEN
    INSERT INTO public.reading_sessions (user_id, book_id, start_page, end_page, duration_seconds, started_at) VALUES
      (me, b_fw,  151, 201, 5700, now() - interval '1 hour'),           -- today   50p 1h35m
      (me, b_fw,  117, 151, 4200, now() - interval '1 day 2 hours'),    -- day 1
      (me, b_fw,   85, 117, 3900, now() - interval '2 days 3 hours'),   -- day 2
      (me, b_fw,   55,  85, 3600, now() - interval '3 days 1 hour'),    -- day 3
      (me, b_fw,   26,  55, 4800, now() - interval '4 days 2 hours'),   -- day 4
      (me, b_fw,    1,  26, 2700, now() - interval '5 days 1 hour');    -- day 5
  END IF;

  IF b_nc IS NOT NULL THEN
    INSERT INTO public.reading_sessions (user_id, book_id, start_page, end_page, duration_seconds, started_at) VALUES
      (me, b_nc,   0, 120, 7200,  now() - interval '44 days'),
      (me, b_nc, 120, 280, 9000,  now() - interval '38 days'),
      (me, b_nc, 280, 387, 6300,  now() - interval '30 days');
  END IF;

  IF b_wit IS NOT NULL THEN
    INSERT INTO public.reading_sessions (user_id, book_id, start_page, end_page, duration_seconds, started_at) VALUES
      (me, b_wit,   0, 150, 9000,  now() - interval '74 days'),
      (me, b_wit, 150, 350, 12600, now() - interval '68 days'),
      (me, b_wit, 350, 476, 8100,  now() - interval '60 days');
  END IF;

  -- ── 5. Friend account ────────────────────────────────────────
  -- Insert into auth.users first (trigger creates the profile)
  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    friend_id, 'authenticated', 'authenticated',
    'alex.rivers.demo@chaperchat.app', '',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"alexrivers"}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  -- Update the auto-created profile with display info
  UPDATE public.profiles SET
    display_name = 'Alex Rivers',
    bio          = 'sci-fi & fantasy 🚀 perpetually in the middle of three books'
  WHERE id = friend_id;

  -- Follow each other
  INSERT INTO public.follows (follower_id, following_id)
  VALUES (me, friend_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.follows (follower_id, following_id)
  VALUES (friend_id, me) ON CONFLICT DO NOTHING;

  -- Friend's library (so they appear in the activity feed)
  IF b_fw IS NOT NULL THEN
    INSERT INTO public.user_books (user_id, book_id, shelf, current_page, added_at)
    VALUES (friend_id, b_fw, 'reading', 300, now() - interval '10 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF b_nc IS NOT NULL THEN
    INSERT INTO public.user_books
      (user_id, book_id, shelf, current_page, rating, finished_at, added_at)
    VALUES (friend_id, b_nc, 'read', 387, 5, now() - interval '7 days', now() - interval '20 days')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ── 6. Activity events ───────────────────────────────────────

  IF b_nc IS NOT NULL THEN
    INSERT INTO public.activity_events (actor_id, event_type, book_id, metadata, created_at)
    VALUES (friend_id, 'finished_book', b_nc,
      '{"rating": 5, "review_snippet": "One of the most beautiful books I have ever read. Absolutely enchanting."}'::jsonb,
      now() - interval '7 days');
  END IF;

  IF b_fw IS NOT NULL THEN
    INSERT INTO public.activity_events (actor_id, event_type, book_id, metadata, created_at)
    VALUES (friend_id, 'shared_session', b_fw,
      '{"pages_read": 85, "duration_seconds": 5400}'::jsonb,
      now() - interval '2 days');

    INSERT INTO public.activity_events (actor_id, event_type, book_id, metadata, created_at)
    VALUES (me, 'started_book', b_fw, '{}'::jsonb, now() - interval '14 days');
  END IF;

  IF b_wit IS NOT NULL THEN
    INSERT INTO public.activity_events (actor_id, event_type, book_id, metadata, created_at)
    VALUES (me, 'finished_book', b_wit,
      '{"rating": 5, "review_snippet": "Mariana Zapata is a genius. Worth every slow-burn page."}'::jsonb,
      now() - interval '60 days');
  END IF;

  -- ── 7. Book club ─────────────────────────────────────────────

  INSERT INTO public.book_clubs (name, description, owner_id)
  VALUES ('Fantasy Addicts 🐉', 'For people who accidentally start three series at once', me)
  RETURNING id INTO club_id;

  INSERT INTO public.club_members (club_id, user_id, role) VALUES
    (club_id, me, 'owner'),
    (club_id, friend_id, 'member');

  IF b_fw IS NOT NULL THEN
    INSERT INTO public.club_books (club_id, book_id, added_by)
    VALUES (club_id, b_fw, me);
  END IF;

  -- Suggestions with votes
  IF b_nc IS NOT NULL THEN
    INSERT INTO public.club_suggestions (id, club_id, book_id, suggested_by)
    VALUES (gen_random_uuid(), club_id, b_nc, friend_id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO sugg_id;

    IF sugg_id IS NOT NULL THEN
      INSERT INTO public.club_suggestion_votes (suggestion_id, user_id)
      VALUES (sugg_id, me) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF b_hib IS NOT NULL THEN
    INSERT INTO public.club_suggestions (club_id, book_id, suggested_by)
    VALUES (club_id, b_hib, me)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.club_posts (club_id, user_id, body) VALUES
    (club_id, friend_id, 'Just hit chapter 15 and I cannot put this down 😭 who else is staying up way too late?'),
    (club_id, me, 'Same!! I told myself just one more chapter three hours ago 💀');

  -- ── 8. Direct message conversation ──────────────────────────

  INSERT INTO public.conversations (
    participant_1, participant_2, last_message_body, last_message_at
  ) VALUES (
    LEAST(me, friend_id), GREATEST(me, friend_id),
    'right?? the ending completely wrecked me 😭',
    now() - interval '45 minutes'
  ) RETURNING id INTO conv_id;

  INSERT INTO public.messages (conversation_id, sender_id, body, created_at, read_at) VALUES
    (conv_id, friend_id, 'ok PLEASE tell me you''ve read The Night Circus',
      now() - interval '2 hours',      now() - interval '1 hour 50 min'),
    (conv_id, me,        'YES it''s one of my all-time favourites 🎪',
      now() - interval '1 hour 50 min', now() - interval '1 hour 45 min'),
    (conv_id, friend_id, 'the atmosphere is just... unreal. nothing else reads like it',
      now() - interval '1 hour 45 min', now() - interval '1 hour 30 min'),
    (conv_id, me,        'right?? the ending completely wrecked me 😭',
      now() - interval '45 minutes',   NULL);

  -- Update conversation last_message
  UPDATE public.conversations SET
    last_message_body = 'right?? the ending completely wrecked me 😭',
    last_message_at   = now() - interval '45 minutes'
  WHERE id = conv_id;

  RAISE NOTICE 'Seed complete ✓  club=% conv=%', club_id, conv_id;
END $$;
