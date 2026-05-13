export interface CuratedBook {
  bookId: string;
  title: string;
  author: string;
  coverUrl: string | null;
}

export interface CuratorGroup {
  label: string;
  groupType: 'series' | 'author' | 'genre' | 'other';
  books: CuratedBook[];
}

export interface CuratorResult {
  groups: CuratorGroup[];
  summary: string;
}

export interface Recommendation {
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
  rationale: string;
}
