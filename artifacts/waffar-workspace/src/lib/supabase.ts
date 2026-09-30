import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.\n" +
    "Copy .env.example to .env and fill in your Supabase project credentials."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          workspace_id: string | null;
          full_name: string;
          email: string;
          avatar_url: string | null;
          avatar_initials: string;
          role: string;
          department: string;
          status: "working" | "online" | "offline";
          created_at: string;
        };
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          code: string;
          created_by: string | null;
          created_at: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          workspace_id: string | null;
          title: string;
          description: string;
          status: "todo" | "in_progress" | "blocked" | "done";
          priority: "low" | "medium" | "high" | "urgent";
          assignee_id: string;
          creator_id: string;
          department: string;
          due_date: string | null;
          created_at: string;
        };
      };
      time_sessions: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number;
          created_at: string;
        };
      };
      task_comments: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          workspace_id: string | null;
          user_id: string;
          task_id: string | null;
          action: string;
          metadata: Record<string, string | number | null>;
          created_at: string;
        };
      };
      chat_channels: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          channel_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
      };
      meeting_rooms: {
        Row: {
          id: string;
          workspace_id: string;
          title: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
      };
      meeting_participants: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          is_muted: boolean;
          is_video_on: boolean;
          is_screen_sharing: boolean;
          joined_at: string;
        };
      };
    };
  };
};
