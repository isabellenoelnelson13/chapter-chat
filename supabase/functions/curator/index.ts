import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a reading list curator. Books are compact JSON: id=bookId, t=title, a=author, s=series (optional). Organize them into groups.

Return ONLY raw JSON, no markdown, no code fences:
{"groups":[{"label":"string","groupType":"series|author|other","ids":["id1","id2"]}],"summary":"1-2 sentences"}

Rules:
- Group by series first (books sharing the same s field), label = series name
- Then group by author if they have 2+ books, label = author name
- Remaining books go in one group: label "Everything Else", groupType "other"
- If a goal is provided, reorder groups to surface the most relevant first
- ids array contains only the id values from the input — nothing else`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, goal } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY secret not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from('user_books')
      .select('id, book_id, books(id, title, author, cover_url, genres, series_name, series_position)')
      .eq('user_id', userId)
      .eq('shelf', 'want')
      .order('added_at', { ascending: false });

    if (error) throw error;

    const books = (data ?? []).slice(0, 100).map((row: any) => {
      const b: Record<string, unknown> = {
        id: row.book_id,
        t: row.books?.title ?? 'Unknown',
        a: row.books?.author ?? 'Unknown',
      };
      if (row.books?.series_name) b.s = row.books.series_name;
      return b;
    });

    const coverMap = new Map(
      (data ?? []).map((row: any) => [row.book_id, row.books?.cover_url ?? null])
    );

    if (books.length === 0) {
      return new Response(
        JSON.stringify({ groups: [], summary: 'Your want-to-read list is empty.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userMessage = goal
      ? `Goal: ${goal}\n\nBooks (id/t=title/a=author/s=series):\n${JSON.stringify(books)}`
      : `Books (id/t=title/a=author/s=series):\n${JSON.stringify(books)}`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      throw new Error(`Anthropic API error: ${anthropicRes.status} ${errText}`);
    }

    const anthropicJson = await anthropicRes.json();
    let raw = anthropicJson.content?.[0]?.text ?? '{}';
    // Strip markdown code fences if present
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const result = JSON.parse(raw);

    // Reconstruct full book objects from the ids Claude returned
    const bookData = new Map(
      (data ?? []).map((row: any) => [row.book_id, {
        bookId: row.book_id,
        title: row.books?.title ?? 'Unknown',
        author: row.books?.author ?? 'Unknown',
        coverUrl: row.books?.cover_url ?? null,
      }])
    );

    const output = {
      summary: result.summary ?? '',
      groups: (result.groups ?? []).map((g: any) => ({
        label: g.label,
        groupType: g.groupType,
        books: (g.ids ?? []).map((id: string) => bookData.get(id)).filter(Boolean),
      })),
    };

    return new Response(JSON.stringify(output), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
