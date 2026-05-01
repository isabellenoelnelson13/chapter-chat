CREATE TABLE IF NOT EXISTS public.inbox_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inbox_notifications_user_id_idx
  ON public.inbox_notifications(user_id, created_at DESC);

ALTER TABLE public.inbox_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.inbox_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.inbox_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role (Edge Function) can insert on behalf of any user
CREATE POLICY "Service role can insert"
  ON public.inbox_notifications FOR INSERT
  WITH CHECK (true);
