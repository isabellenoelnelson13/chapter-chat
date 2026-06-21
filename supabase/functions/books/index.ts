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
  book_series { position series { id name } }
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

const BOOK_BY_ID_QUERY = `
  query BookById($id: Int!) {
    books_by_pk(id: $id) {
      ${BOOK_FIELDS}
    }
  }
`;

const SERIES_QUERY = `
  query SeriesBooks($series_id: Int!) {
    book_series(
      where: { series_id: { _eq: $series_id } }
      order_by: { position: asc_nulls_last }
    ) {
      position
      book {
        ${BOOK_FIELDS}
      }
    }
  }
`;

const REVIEWS_QUERY = `
  query BookReviews($book_id: Int!, $limit: Int!) {
    user_books(
      where: {
        book_id: { _eq: $book_id }
        review: { _is_null: false }
      }
      limit: $limit
      order_by: { rating: desc_nulls_last }
    ) {
      rating
      review
      user { username }
    }
  }
`;

const ISBN_QUERY = `
  query BookByISBN($isbn: String!) {
    books(
      where: {
        _or: [
          { editions: { isbn_13: { _eq: $isbn } } }
          { editions: { isbn_10: { _eq: $isbn } } }
        ]
      }
      limit: 1
    ) {
      ${BOOK_FIELDS}
    }
  }
`;

const TRENDING_SINCE_QUERY = `
  query TrendingSince($limit: Int!, $since: date!) {
    books(
      order_by: { users_read_count: desc }
      limit: $limit
      where: {
        users_read_count: { _gt: 10 }
        release_date: { _gte: $since }
      }
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
  series_id: string | null;
  series_name: string | null;
  series_position: number | null;
}

function normalizeBook(b: any): BookResult {
  const seriesEntry = Array.isArray(b.book_series) ? b.book_series[0] : null;
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
    series_id: seriesEntry ? String(seriesEntry.series.id) : null,
    series_name: seriesEntry?.series?.name ?? null,
    series_position: seriesEntry?.position ?? null,
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
    genres: Array.isArray(doc.genres)
      ? doc.genres.filter(Boolean)
      : Array.isArray(doc.cached_tags)
      ? doc.cached_tags
          .map((t: any) => (typeof t === 'string' ? t : t?.tag))
          .filter(Boolean)
      : null,
    description: doc.description ?? null,
    rating: typeof doc.rating === 'number' ? doc.rating : null,
    users_read_count: doc.users_read_count ?? 0,
    series_id: null,
    series_name: null,
    series_position: null,
  };
}

function sinceDate(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
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
    const { action, query, period, hardcover_id, series_id, isbn, limit = 20 } = await req.json();
    const apiKey = Deno.env.get('HARDCOVER_API_KEY') ?? '';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'HARDCOVER_API_KEY secret not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let books: BookResult[];

    if (action === 'isbn') {
      const json = await queryHardcover(apiKey, ISBN_QUERY, { isbn: String(isbn ?? '') });
      const b = json.data?.books?.[0];
      const result = b ? normalizeBook(b) : null;
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (action === 'search') {
      const json = await queryHardcover(apiKey, SEARCH_QUERY, {
        query: String(query ?? ''),
        per_page: Number(limit),
      });
      const rawResults = json.data?.search?.results;
      const parsed = typeof rawResults === 'string' ? JSON.parse(rawResults) : rawResults;
      const hits: any[] = Array.isArray(parsed) ? parsed : (parsed?.hits ?? []);
      books = hits.map(normalizeSearchHit);
    } else if (action === 'trending') {
      const days = period === 'last_month' ? 30
        : period === '3_months' ? 90
        : period === '1_year' ? 365
        : null;

      if (days !== null) {
        const json = await queryHardcover(apiKey, TRENDING_SINCE_QUERY, {
          limit: Number(limit),
          since: sinceDate(days),
        });
        books = (json.data?.books ?? []).map(normalizeBook);
      } else {
        const json = await queryHardcover(apiKey, TRENDING_QUERY, {
          limit: Number(limit),
        });
        books = (json.data?.books ?? []).map(normalizeBook);
      }
    } else if (action === 'reviews') {
      const bookIdInt = parseInt(String(hardcover_id ?? ''), 10);
      if (isNaN(bookIdInt)) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const json = await queryHardcover(apiKey, REVIEWS_QUERY, {
        book_id: bookIdInt,
        limit: Number(limit),
      });
      const reviews = (json.data?.user_books ?? []).map((r: any) => ({
        rating: typeof r.rating === 'number' ? r.rating : null,
        review: r.review,
        username: r.user?.username ?? 'Anonymous',
      }));
      return new Response(JSON.stringify(reviews), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (action === 'book') {
      const bookIdInt = parseInt(String(hardcover_id ?? ''), 10);
      if (isNaN(bookIdInt)) {
        return new Response(JSON.stringify(null), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const json = await queryHardcover(apiKey, BOOK_BY_ID_QUERY, { id: bookIdInt });
      const b = json.data?.books_by_pk;
      const result = b ? normalizeBook(b) : null;
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (action === 'series') {
      const seriesIdInt = parseInt(String(series_id ?? ''), 10);
      if (isNaN(seriesIdInt)) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const json = await queryHardcover(apiKey, SERIES_QUERY, { series_id: seriesIdInt });
      const entries: any[] = json.data?.book_series ?? [];

      // Deduplicate by position: keep the edition with the most readers (main English edition wins)
      const byPosition = new Map<number | null, { result: BookResult; readers: number }>();
      for (const e of entries) {
        if (!e.book) continue;
        const b = { ...e.book, book_series: [{ position: e.position, series: { id: seriesIdInt, name: '' } }] };
        const normalized = { ...normalizeBook(b), series_position: e.position ?? null };
        const pos = e.position ?? null;
        const readers = normalized.users_read_count;
        const existing = byPosition.get(pos);
        if (!existing || readers > existing.readers) {
          byPosition.set(pos, { result: normalized, readers });
        }
      }
      books = Array.from(byPosition.values())
        .map((v) => v.result)
        .sort((a, b) => (a.series_position ?? 999) - (b.series_position ?? 999));
    } else if (action === 'cover_search') {
      const googleKey = Deno.env.get('GOOGLE_BOOKS_API_KEY') ?? '';
      const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(String(query ?? ''))}&maxResults=20${googleKey ? `&key=${googleKey}` : ''}`;
      const googleRes = await fetch(googleUrl);
      if (!googleRes.ok) throw new Error(`Google Books error: ${googleRes.status}`);
      const googleJson = await googleRes.json();
      const coverUrls = (googleJson.items ?? [])
        .map((item: any) => {
          const links = item.volumeInfo?.imageLinks;
          return links?.large ?? links?.medium ?? links?.thumbnail ?? null;
        })
        .filter(Boolean)
        .map((u: string) => u.replace('http://', 'https://'));
      return new Response(JSON.stringify(coverUrls), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
