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
          hardcover_id: string | null;
          title: string;
          author: string;
          cover_url: string | null;
          page_count: number | null;
          genres: string[] | null;
          description: string | null;
          rating: number | null;
          users_read_count: number | null;
          series_id: string | null;
          series_name: string | null;
          series_position: number | null;
          goodreads_id: string | null;
          goodreads_author_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          hardcover_id?: string | null;
          title: string;
          author: string;
          cover_url?: string | null;
          page_count?: number | null;
          genres?: string[] | null;
          description?: string | null;
          rating?: number | null;
          users_read_count?: number | null;
          series_id?: string | null;
          series_name?: string | null;
          series_position?: number | null;
          goodreads_id?: string | null;
          goodreads_author_id?: string | null;
          created_at?: string;
        };
        Update: {
          hardcover_id?: string | null;
          title?: string;
          author?: string;
          cover_url?: string | null;
          page_count?: number | null;
          genres?: string[] | null;
          description?: string | null;
          rating?: number | null;
          users_read_count?: number | null;
          series_id?: string | null;
          series_name?: string | null;
          series_position?: number | null;
          goodreads_id?: string | null;
          goodreads_author_id?: string | null;
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
          started_at: string | null;
          finished_at: string | null;
          format: 'physical' | 'ebook' | 'audiobook';
          progress_percent: number | null;
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
          started_at?: string | null;
          finished_at?: string | null;
          format?: 'physical' | 'ebook' | 'audiobook';
          progress_percent?: number | null;
        };
        Update: {
          shelf?: Shelf;
          current_page?: number;
          rating?: number | null;
          review?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          format?: 'physical' | 'ebook' | 'audiobook';
          progress_percent?: number | null;
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
      authors: {
        Row: {
          id: string;
          goodreads_author_id: string;
          name: string;
          bio: string | null;
          photo_url: string | null;
          born_date: string | null;
          website: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          goodreads_author_id: string;
          name: string;
          bio?: string | null;
          photo_url?: string | null;
          born_date?: string | null;
          website?: string | null;
          created_at?: string;
        };
        Update: {
          goodreads_author_id?: string;
          name?: string;
          bio?: string | null;
          photo_url?: string | null;
          born_date?: string | null;
          website?: string | null;
        };
      };
      book_reviews: {
        Row: {
          id: string;
          book_id: string;
          goodreads_review_id: string | null;
          reviewer_name: string | null;
          rating: number | null;
          body: string | null;
          date_added: string | null;
          helpful_votes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          goodreads_review_id?: string | null;
          reviewer_name?: string | null;
          rating?: number | null;
          body?: string | null;
          date_added?: string | null;
          helpful_votes?: number;
          created_at?: string;
        };
        Update: {
          book_id?: string;
          goodreads_review_id?: string | null;
          reviewer_name?: string | null;
          rating?: number | null;
          body?: string | null;
          date_added?: string | null;
          helpful_votes?: number;
        };
      };
      inbox_notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          data: Record<string, unknown> | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body: string;
          data?: Record<string, unknown> | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          read?: boolean;
        };
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          created_at?: string;
        };
        Update: {
          token?: string;
        };
      };
      notification_preferences: {
        Row: {
          user_id: string;
          reading_reminder_enabled: boolean;
          reading_reminder_hour: number;
          reading_reminder_minute: number;
          streak_protection_enabled: boolean;
          club_posts_enabled: boolean;
          weekly_summary_enabled: boolean;
          comment_notifications_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          reading_reminder_enabled?: boolean;
          reading_reminder_hour?: number;
          reading_reminder_minute?: number;
          streak_protection_enabled?: boolean;
          club_posts_enabled?: boolean;
          weekly_summary_enabled?: boolean;
          comment_notifications_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          reading_reminder_enabled?: boolean;
          reading_reminder_hour?: number;
          reading_reminder_minute?: number;
          streak_protection_enabled?: boolean;
          club_posts_enabled?: boolean;
          weekly_summary_enabled?: boolean;
          comment_notifications_enabled?: boolean;
          updated_at?: string;
        };
      };
    };
  };
}
