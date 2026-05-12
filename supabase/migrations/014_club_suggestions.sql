-- Club book suggestions
CREATE TABLE public.club_suggestions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      uuid NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  book_id      uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  suggested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, book_id)
);

ALTER TABLE public.club_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view suggestions"
  ON public.club_suggestions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = club_suggestions.club_id AND user_id = auth.uid()
  ));

CREATE POLICY "Club members can add suggestions"
  ON public.club_suggestions FOR INSERT
  WITH CHECK (
    auth.uid() = suggested_by AND
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_suggestions.club_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Suggester or owner can delete suggestion"
  ON public.club_suggestions FOR DELETE
  USING (
    auth.uid() = suggested_by OR
    EXISTS (
      SELECT 1 FROM public.book_clubs
      WHERE id = club_suggestions.club_id AND owner_id = auth.uid()
    )
  );

-- Votes on suggestions
CREATE TABLE public.club_suggestion_votes (
  suggestion_id uuid NOT NULL REFERENCES public.club_suggestions(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (suggestion_id, user_id)
);

ALTER TABLE public.club_suggestion_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view votes"
  ON public.club_suggestion_votes FOR SELECT USING (true);

CREATE POLICY "Users can cast their own vote"
  ON public.club_suggestion_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own vote"
  ON public.club_suggestion_votes FOR DELETE
  USING (auth.uid() = user_id);
