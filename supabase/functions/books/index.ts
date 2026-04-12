import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const HARDCOVER_URL = 'https://api.hardcover.app/v1/graphql';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOOK_FIELDS = `
  id
  title
  pages
  description
  image { url }
  contributions { author { name } }
  cached_tags
  rating
  users_read_count
`;

const SEARCH_QUERY = `
  query SearchBooks($query: String!, $per_page: Int!) {
    search(query: $query, query_type: "Book", per_page: $per_page) {
      results
    }
  }
`;

const TRENDING_QUERY = `
  query TrendingBooks($limit: Int!) {
    books(
      order_by: { users_read_count: desc }
      limit: $limit
      where: { users_read_count: { _gt: 100 } }
    ) {
      ${BOOK_FIELDS}
    }
  }
`;

const BY_GENRE_QUERY = `
  query BooksByGenre($genre: String!, $limit: Int!) {
    books(
      where: { taggings: { tag: { tag: { _ilike: $genre } } } }
      order_by: { users_read_count: desc }
      limit: $limit
    ) {
      ${BOOK_FIELDS}
    }
  }
`;

interface BookResult {
  hardcover_id: string;
  title: string;
  author: string;
  cover_url: string | null;
  page_count: number | null;
  genres: string[] | null;
  description: string | null;
  rating: number | null;
  users_read_count: number;
}

function normalizeBook(b: any): BookResult {
  return {
    hardcover_id: String(b.id),
    title: b.title ?? 'Unknown Title',
    author: b.contributions?.[0]?.author?.name ?? 'Unknown Author',
    cover_url: b.image?.url ?? null,
    page_count: b.pages ?? null,
    genres: Array.isArray(b.cached_tags)
      ? b.cached_tags
          .map((t: any) => (typeof t === 'string' ? t : t?.tag))
          .filter(Boolean)
      : null,
    description: b.description ?? null,
    rating: typeof b.rating === 'number' ? b.rating : null,
    users_read_count: b.users_read_count ?? 0,
  };
}

// Search results come back as a Typesense JSON blob with different field names
function normalizeSearchHit(hit: any): BookResult {
  const doc = hit.document ?? hit;
  return {
    hardcover_id: String(doc.id),
    title: doc.title ?? 'Unknown Title',
    author: Array.isArray(doc.author_names)
      ? (doc.author_names[0] ?? 'Unknown Author')
      : 'Unknown Author',
    cover_url: doc.image?.url ?? doc.cover_image_url ?? null,
    page_count: doc.pages ?? null,
    genres: Array.isArray(doc.cached_tags)
      ? doc.cached_tags
          .map((t: any) => (typeof t === 'string' ? t : t?.tag))
          .filter(Boolean)
      : null,
    description: doc.description ?? null,
    rating: typeof doc.rating === 'number' ? doc.rating : null,
    users_read_count: doc.users_read_count ?? 0,
  };
}

async function queryHardcover(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>
): Promise<any> {
  const res = await fetch(HARDCOVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Hardcover API error: ${res.status}`);
  return res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, query, genre, limit = 20 } = await req.json();
    const apiKey = Deno.env.get('HARDCOVER_API_KEY') ?? '';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'HARDCOVER_API_KEY secret not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let books: BookResult[];

    if (action === 'search') {
      const json = await queryHardcover(apiKey, SEARCH_QUERY, {
        query: String(query ?? ''),
        per_page: Number(limit),
      });
      const rawResults = json.data?.search?.results;
      // results is a JSON string from Typesense — parse it if needed
      const hits: any[] = typeof rawResults === 'string'
        ? JSON.parse(rawResults)
        : (Array.isArray(rawResults) ? rawResults : []);
      books = hits.map(normalizeSearchHit);
    } else if (action === 'trending') {
      const json = await queryHardcover(apiKey, TRENDING_QUERY, {
        limit: Number(limit),
      });
      books = (json.data?.books ?? []).map(normalizeBook);
    } else if (action === 'by_genre') {
      const json = await queryHardcover(apiKey, BY_GENRE_QUERY, {
        genre: String(genre ?? ''),
        limit: Number(limit),
      });
      books = (json.data?.books ?? []).map(normalizeBook);
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(books), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
