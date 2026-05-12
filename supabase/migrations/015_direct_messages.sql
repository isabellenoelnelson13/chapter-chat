-- Direct messaging

CREATE TABLE public.conversations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at  timestamptz NOT NULL DEFAULT now(),
  last_message_body text,
  deleted_for      uuid[] NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (participant_1 < participant_2),
  UNIQUE(participant_1, participant_2)
);

CREATE TABLE public.messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            text NOT NULL,
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages     ENABLE ROW LEVEL SECURITY;

-- Conversations: only participants can see or update
CREATE POLICY "Participants can view their conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Authenticated users can start a conversation"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Participants can update last_message fields"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Messages: participants of the conversation can read; sender can insert
CREATE POLICY "Participants can read messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = messages.conversation_id
        AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
    )
  );

CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = messages.conversation_id
        AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
    )
  );

CREATE POLICY "Recipient can mark messages read"
  ON public.messages FOR UPDATE
  USING (
    auth.uid() != sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = messages.conversation_id
        AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
    )
  );

CREATE INDEX messages_conversation_id_idx ON public.messages(conversation_id);
CREATE INDEX messages_created_at_idx      ON public.messages(conversation_id, created_at);
