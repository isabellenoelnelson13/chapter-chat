import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HARDCOVER_URL = 'https://api.hardcover.app/v1/graphql';

const SEARCH_QUERY = `
  query SearchBooks($query: String!, $per_page: Int!) {
    search(query: $query, query_type: "Book", per_page: $per_page) {
      results
    }
  }
`;

function normalizeHit(hit: any) {
  const doc = hit.document ?? hit;
  return {
    hardcover_id: String(doc.id),
    title: doc.title ?? 'Unknown Title',
    author: Array.isArray(doc.author_names) ? (doc.author_names[0] ?? 'Unknown') : 'Unknown',
    cover_url: doc.image?.url ?? doc.cover_image_url ?? null,
    page_count: doc.pages ?? null,
    genres: Array.isArray(doc.genres) ? doc.genres.filter(Boolean) : null,
    description: doc.description ?? null,
    rating: typeof doc.rating === 'number' ? doc.rating : null,
    users_read_count: doc.users_read_count ?? 0,
    series_id: null,
    series_name: null,
    series_position: null,
  };
}

async function searchHardcover(apiKey: string, query: string): Promise<any[]> {
  try {
    const res = await fetch(HARDCOVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query: SEARCH_QUERY, variables: { query, per_page: 10 } }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const rawResults = json.data?.search?.results;
    const parsed = typeof rawResults === 'string' ? JSON.parse(rawResults) : rawResults;
    const hits: any[] = Array.isArray(parsed) ? parsed : (parsed?.hits ?? []);
    return hits.map(normalizeHit);
  } catch {
    return [];
  }
}

function extractJson(text: string): any {
  // Strip code fences
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  // Try direct parse
  try { return JSON.parse(stripped); } catch { /* fall through */ }
  // Try extracting the first {...} block
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* fall through */ }
  }
  return null;
}

const SYSTEM_PROMPT = `You are a book recommendation engine. Given a user's reading history and a list of candidate books, pick the 8 best recommendations.

Return ONLY raw JSON — no markdown, no code fences, no explanation:
{"recommendations":[{"hardcover_id":"string","rationale":"one sentence why this fits their taste"}]}

Rules:
- Only pick books from the candidates list
- Rank by how well they match the user's demonstrated taste
- Each rationale must be specific to this user's taste, not generic`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
    const hardcoverKey = Deno.env.get('HARDCOVER_API_KEY') ?? '';

    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: shelfData } = await supabase
      .from('user_books')
      .select('rating, shelf, books(hardcover_id, title, author, genres)')
      .eq('user_id', userId)
      .in('shelf', ['read', 'reading', 'want'])
      .limit(50);

    const userBooks = (shelfData ?? []).map((row: any) => ({
      hardcover_id: row.books?.hardcover_id ?? null,
      title: row.books?.title ?? 'Unknown',
      author: row.books?.author ?? 'Unknown',
      rating: row.rating,
      shelf: row.shelf,
      genres: (row.books?.genres ?? []).slice(0, 3),
    }));

    if (userBooks.length < 3) {
      return new Response(JSON.stringify({ recommendations: [], personalized: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const excludeIds = new Set(userBooks.map((b: any) => b.hardcover_id).filter(Boolean));
    const excludeTitles = new Set(userBooks.map((b: any) => b.title.toLowerCase()));

    // Build search queries from the user's taste profile
    const topRated = userBooks.filter((b: any) => b.rating >= 4).slice(0, 10);
    const allBooks = topRated.length >= 2 ? topRated : userBooks.slice(0, 10);

    const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

    const genres = shuffle([...new Set(allBooks.flatMap((b: any) => b.genres))].filter(Boolean));
    const authors = shuffle([...new Set(allBooks.map((b: any) => b.author))].filter(Boolean));

    // Build a pool of candidate queries, then pick 4 at random each run
    const queryPool: string[] = [
      genres[0] && genres[1] ? `${genres[0]} ${genres[1]}` : '',
      genres[0] ? `best ${genres[0]} novels` : '',
      genres[0] ? `${genres[0]} bestseller` : '',
      genres[1] ? `${genres[1]} popular fiction` : '',
      genres[2] ? `${genres[2]} fiction` : '',
      authors[0] ? authors[0] : '',
      authors[1] ? authors[1] : '',
      authors[2] ? authors[2] : '',
    ].filter(Boolean);

    const queries = shuffle(queryPool).slice(0, 4);
    if (queries.length < 4) queries.push('popular fiction bestseller');

    // Run all searches in parallel
    const searchResults = await Promise.all(queries.slice(0, 4).map((q) => searchHardcover(hardcoverKey, q)));

    // Deduplicate and filter out user's existing books
    const seen = new Set<string>();
    const candidates = searchResults
      .flat()
      .filter((b) => {
        if (seen.has(b.hardcover_id)) return false;
        if (excludeIds.has(b.hardcover_id)) return false;
        if (excludeTitles.has(b.title.toLowerCase())) return false;
        seen.add(b.hardcover_id);
        return true;
      })
      .slice(0, 40);

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ recommendations: [], personalized: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Single Claude call to rank and explain
    const userHistory = userBooks.map((b: any) => ({
      t: b.title, a: b.author, r: b.rating, s: b.shelf,
    }));
    const candidateList = candidates.map((b) => ({
      id: b.hardcover_id, t: b.title, a: b.author, r: b.rating,
    }));

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `My reading history (t=title,a=author,r=rating,s=shelf):\n${JSON.stringify(userHistory)}\n\nCandidates (id=hardcover_id,t=title,a=author,r=rating):\n${JSON.stringify(candidateList)}`,
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      throw new Error(`Anthropic error: ${anthropicRes.status} ${errText}`);
    }

    const anthropicJson = await anthropicRes.json();
    const rawText = anthropicJson.content?.[0]?.text ?? '{}';
    const parsed = extractJson(rawText);

    if (!parsed) {
      return new Response(JSON.stringify({ recommendations: [], personalized: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bookLookup = new Map(candidates.map((b) => [b.hardcover_id, b]));

    const recommendations = (parsed.recommendations ?? [])
      .map((pick: any) => {
        const book = bookLookup.get(pick.hardcover_id);
        if (!book) return null;
        return { ...book, rationale: pick.rationale ?? '' };
      })
      .filter(Boolean)
      .slice(0, 8);

    return new Response(JSON.stringify({ recommendations, personalized: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
