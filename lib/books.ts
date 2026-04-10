import { supabase } from './supabase';

const GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1';
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY ?? '';

export interface BookSearchResult {
  google_books_id: string;
  title: string;
  author: string;
  cover_url: string | null;
  page_count: number | null;
  genres: string[] | null;
}

export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  const params = new URLSearchParams({ q: query, maxResults: '20' });
  if (API_KEY) params.set('key', API_KEY);
  const res = await fetch(`${GOOGLE_BOOKS_BASE}/volumes?${params}`);
  if (!res.ok) throw new Error(`Google Books API error: ${res.status}`);
  const json = await res.json();
  return (json.items ?? []).map(volumeToBook);
}

export async function fetchBookByGoogleId(googleBooksId: string): Promise<BookSearchResult | null> {
  const params = new URLSearchParams();
  if (API_KEY) params.set('key', API_KEY);
  const qs = API_KEY ? `?${params}` : '';
  const res = await fetch(`${GOOGLE_BOOKS_BASE}/volumes/${googleBooksId}${qs}`);
  if (!res.ok) return null;
  const json = await res.json();
  return volumeToBook(json);
}

function volumeToBook(volume: any): BookSearchResult {
  const info = volume.volumeInfo ?? {};
  const thumbnail: string | null = info.imageLinks?.thumbnail ?? null;
  return {
    google_books_id: volume.id ?? '',
    title: info.title ?? 'Unknown Title',
    author: (info.authors ?? [])[0] ?? 'Unknown Author',
    cover_url: thumbnail ? thumbnail.replace('http://', 'https://') : null,
    page_count: info.pageCount ?? null,
    genres: info.categories ?? null,
  };
}

export async function upsertBook(book: BookSearchResult): Promise<string> {
  const { data, error } = await supabase
    .from('books')
    .upsert(
      {
        google_books_id: book.google_books_id,
        title: book.title,
        author: book.author,
        cover_url: book.cover_url,
        page_count: book.page_count,
        genres: book.genres,
      },
      { onConflict: 'google_books_id' }
    )
    .select('id')
    .single();
  if (error) throw error;
  if (!data) throw new Error('upsertBook: no data returned from Supabase');
  return data.id;
}
