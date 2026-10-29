export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      customers: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          last_seen: string | null;
          name: string | null;
          notes: string | null;
          org_id: string;
          tags: string[];
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: string;
          last_seen?: string | null;
          name?: string | null;
          notes?: string | null;
          org_id: string;
          tags?: string[];
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          last_seen?: string | null;
          name?: string | null;
          notes?: string | null;
          org_id?: string;
          tags?: string[];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      email_send_log: {
        Row: {
          created_at: string;
          error_message: string | null;
          id: string;
          message_id: string | null;
          metadata: Json | null;
          recipient_email: string;
          status: string;
          template_name: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          message_id?: string | null;
          metadata?: Json | null;
          recipient_email: string;
          status: string;
          template_name: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          id?: string;
          message_id?: string | null;
          metadata?: Json | null;
          recipient_email?: string;
          status?: string;
          template_name?: string;
        };
        Relationships: [];
      };
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number;
          batch_size: number;
          id: number;
          retry_after_until: string | null;
          send_delay_ms: number;
          transactional_email_ttl_minutes: number;
          updated_at: string;
        };
        Insert: {
          auth_email_ttl_minutes?: number;
          batch_size?: number;
          id?: number;
          retry_after_until?: string | null;
          send_delay_ms?: number;
          transactional_email_ttl_minutes?: number;
          updated_at?: string;
        };
        Update: {
          auth_email_ttl_minutes?: number;
          batch_size?: number;
          id?: number;
          retry_after_until?: string | null;
          send_delay_ms?: number;
          transactional_email_ttl_minutes?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_unsubscribe_tokens: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          token: string;
          used_at: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          token: string;
          used_at?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          token?: string;
          used_at?: string | null;
        };
        Relationships: [];
      };
      event_memories: {
        Row: {
          caption: string | null;
          created_at: string;
          event_id: string;
          id: string;
          photo_url: string;
          user_id: string;
        };
        Insert: {
          caption?: string | null;
          created_at?: string;
          event_id: string;
          id?: string;
          photo_url: string;
          user_id: string;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          event_id?: string;
          id?: string;
          photo_url?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          capacity: number | null;
          category: string;
          city: string | null;
          created_at: string;
          description: string | null;
          ends_at: string | null;
          id: string;
          latitude: number | null;
          longitude: number | null;
          org_id: string;
          price: number | null;
          starts_at: string;
          tags: string[];
          title: string;
          venue: string | null;
        };
        Insert: {
          capacity?: number | null;
          category: string;
          city?: string | null;
          created_at?: string;
          description?: string | null;
          ends_at?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          org_id: string;
          price?: number | null;
          starts_at: string;
          tags?: string[];
          title: string;
          venue?: string | null;
        };
        Update: {
          capacity?: number | null;
          category?: string;
          city?: string | null;
          created_at?: string;
          description?: string | null;
          ends_at?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          org_id?: string;
          price?: number | null;
          starts_at?: string;
          tags?: string[];
          title?: string;
          venue?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      landmark_qloo_map: {
        Row: {
          candidates: Json;
          confidence: string;
          entity_address: string | null;
          entity_id: string | null;
          entity_name: string | null;
          landmark_id: string;
          note: string | null;
          resolved_at: string;
        };
        Insert: {
          candidates?: Json;
          confidence: string;
          entity_address?: string | null;
          entity_id?: string | null;
          entity_name?: string | null;
          landmark_id: string;
          note?: string | null;
          resolved_at?: string;
        };
        Update: {
          candidates?: Json;
          confidence?: string;
          entity_address?: string | null;
          entity_id?: string | null;
          entity_name?: string | null;
          landmark_id?: string;
          note?: string | null;
          resolved_at?: string;
        };
        Relationships: [];
      };
      oauth_tokens: {
        Row: {
          access_token: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          provider: string;
          provider_user_id: string | null;
          refresh_token: string | null;
          scope: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_token: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          provider: string;
          provider_user_id?: string | null;
          refresh_token?: string | null;
          scope?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          provider?: string;
          provider_user_id?: string | null;
          refresh_token?: string | null;
          scope?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          category: string;
          city: string | null;
          created_at: string;
          description: string | null;
          id: string;
          latitude: number | null;
          longitude: number | null;
          name: string;
          owner_id: string | null;
        };
        Insert: {
          category: string;
          city?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          owner_id?: string | null;
        };
        Update: {
          category?: string;
          city?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          owner_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          bio: string | null;
          city: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          latitude: number | null;
          longitude: number | null;
          onboarded: boolean;
          updated_at: string;
        };
        Insert: {
          bio?: string | null;
          city?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          latitude?: number | null;
          longitude?: number | null;
          onboarded?: boolean;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          city?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          onboarded?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      prompts: {
        Row: {
          city: string | null;
          created_at: string;
          id: string;
          latitude: number | null;
          longitude: number | null;
          tags: string[];
          text: string;
          user_id: string;
        };
        Insert: {
          city?: string | null;
          created_at?: string;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          tags?: string[];
          text: string;
          user_id: string;
        };
        Update: {
          city?: string | null;
          created_at?: string;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          tags?: string[];
          text?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      saved_items: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          payload: Json;
          ref_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          payload?: Json;
          ref_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          payload?: Json;
          ref_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      community_follows: {
        Row: {
          created_at: string;
          org_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          org_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          org_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_follows_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      rsvps: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rsvps_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      social_integrations: {
        Row: {
          connected_at: string;
          handle: string | null;
          id: string;
          provider: string;
          tags: string[];
          user_id: string;
        };
        Insert: {
          connected_at?: string;
          handle?: string | null;
          id?: string;
          provider: string;
          tags?: string[];
          user_id: string;
        };
        Update: {
          connected_at?: string;
          handle?: string | null;
          id?: string;
          provider?: string;
          tags?: string[];
          user_id?: string;
        };
        Relationships: [];
      };
      suppressed_emails: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          metadata: Json | null;
          reason: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          metadata?: Json | null;
          reason: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          metadata?: Json | null;
          reason?: string;
        };
        Relationships: [];
      };
      taste_profiles: {
        Row: {
          films: string[];
          free_text: string | null;
          interests: string[];
          music: string[];
          sports: string[];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          films?: string[];
          free_text?: string | null;
          interests?: string[];
          music?: string[];
          sports?: string[];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          films?: string[];
          free_text?: string | null;
          interests?: string[];
          music?: string[];
          sports?: string[];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_badges: {
        Row: {
          badge_code: string;
          earned_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          badge_code: string;
          earned_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          badge_code?: string;
          earned_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_stats: {
        Row: {
          current_streak: number;
          last_event_at: string | null;
          level: number;
          longest_streak: number;
          updated_at: string;
          user_id: string;
          xp: number;
        };
        Insert: {
          current_streak?: number;
          last_event_at?: string | null;
          level?: number;
          longest_streak?: number;
          updated_at?: string;
          user_id: string;
          xp?: number;
        };
        Update: {
          current_streak?: number;
          last_event_at?: string | null;
          level?: number;
          longest_streak?: number;
          updated_at?: string;
          user_id?: string;
          xp?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string };
        Returns: boolean;
      };
      enqueue_email: {
        Args: { payload: Json; queue_name: string };
        Returns: number;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      move_to_dlq: {
        Args: {
          dlq_name: string;
          message_id: number;
          payload: Json;
          source_queue: string;
        };
        Returns: number;
      };
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number };
        Returns: {
          message: Json;
          msg_id: number;
          read_ct: number;
        }[];
      };
    };
    Enums: {
      app_role: "member" | "organizer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["member", "organizer"],
    },
  },
} as const;
