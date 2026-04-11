export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Shelf = 'reading' | 'want' | 'read' | 'dnf';
export type ClubRole = 'owner' | 'member';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          bio: string | null;
          is_private: boolean;
          yearly_goal: number;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          avatar_url?: string | null;
          bio?: string | null;
          is_private?: boolean;
          yearly_goal?: number;
          created_at?: string;
        };
        Update: {
          username?: string;
          avatar_url?: string | null;
          bio?: string | null;
          is_private?: boolean;
          yearly_goal?: number;
        };
      };
      books: {
        Row: {
          id: string;
          google_books_id: string | null;
          title: string;
          author: string;
          cover_url: string | null;
          page_count: number | null;
          genres: string[] | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          google_books_id?: string | null;
          title: string;
          author: string;
          cover_url?: string | null;
          page_count?: number | null;
          genres?: string[] | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          google_books_id?: string | null;
          title?: string;
          author?: string;
          cover_url?: string | null;
          page_count?: number | null;
          genres?: string[] | null;
          description?: string | null;
        };
      };
      user_books: {
        Row: {
          id: string;
          user_id: string;
          book_id: string;
          shelf: Shelf;
          current_page: number;
          rating: number | null;
          review: string | null;
          added_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: string;
          shelf: Shelf;
          current_page?: number;
          rating?: number | null;
          review?: string | null;
          added_at?: string;
          finished_at?: string | null;
        };
        Update: {
          shelf?: Shelf;
          current_page?: number;
          rating?: number | null;
          review?: string | null;
          finished_at?: string | null;
        };
      };
      reading_sessions: {
        Row: {
          id: string;
          user_id: string;
          book_id: string;
          start_page: number;
          end_page: number;
          duration_seconds: number;
          started_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: string;
          start_page: number;
          end_page: number;
          duration_seconds: number;
          started_at: string;
          created_at?: string;
        };
        Update: never;
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: never;
      };
      book_clubs: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string;
          current_book_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id: string;
          current_book_id?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          current_book_id?: string | null;
        };
      };
      club_members: {
        Row: {
          club_id: string;
          user_id: string;
          role: ClubRole;
          joined_at: string;
        };
        Insert: {
          club_id: string;
          user_id: string;
          role?: ClubRole;
          joined_at?: string;
        };
        Update: {
          role?: ClubRole;
        };
      };
      club_posts: {
        Row: {
          id: string;
          club_id: string;
          user_id: string;
          body: string;
          parent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          user_id: string;
          body: string;
          parent_id?: string | null;
          created_at?: string;
        };
        Update: {
          body?: string;
        };
      };
      club_books: {
        Row: {
          id: string;
          club_id: string;
          book_id: string;
          added_by: string;
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          book_id: string;
          added_by: string;
          started_at?: string;
          ended_at?: string | null;
        };
        Update: {
          ended_at?: string | null;
        };
      };
      challenges: {
        Row: {
          id: string;
          creator_id: string;
          title: string;
          goal: number;
          start_date: string;
          end_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title: string;
          goal: number;
          start_date: string;
          end_date: string;
          created_at?: string;
        };
        Update: {
          title?: string;
          goal?: number;
          start_date?: string;
          end_date?: string;
        };
      };
      challenge_members: {
        Row: {
          challenge_id: string;
          user_id: string;
          progress: number;
          joined_at: string;
        };
        Insert: {
          challenge_id: string;
          user_id: string;
          progress?: number;
          joined_at?: string;
        };
        Update: {
          progress?: number;
        };
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string;
          body: string;
          sent_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          sender_id: string;
          recipient_id: string;
          body: string;
          sent_at?: string;
          read_at?: string | null;
        };
        Update: {
          read_at?: string | null;
        };
      };
    };
  };
}
