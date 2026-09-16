export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      jobs: {
        Row: {
          city: string | null
          company: string
          contract_type: string
          country: string
          date_added: string
          duration: string | null
          id: string
          language: Json
          last_verified: string
          match_score: number
          match_summary: string | null
          missing_requirements: string[]
          partial_matches: string[]
          publication_date: string
          recommendation: string
          red_flags: string[]
          role_category: string
          role_title_group: string | null
          source: string | null
          status: string
          strong_matches: string[]
          title: string
          transferable_experience: string[]
          url: string | null
          work_model: string
        }
        Insert: {
          city?: string | null
          company: string
          contract_type: string
          country: string
          date_added?: string
          duration?: string | null
          id?: string
          language?: Json
          last_verified?: string
          match_score?: number
          match_summary?: string | null
          missing_requirements?: string[]
          partial_matches?: string[]
          publication_date: string
          recommendation?: string
          red_flags?: string[]
          role_category: string
          role_title_group?: string | null
          source?: string | null
          status?: string
          strong_matches?: string[]
          title: string
          transferable_experience?: string[]
          url?: string | null
          work_model: string
        }
        Update: {
          city?: string | null
          company?: string
          contract_type?: string
          country?: string
          date_added?: string
          duration?: string | null
          id?: string
          language?: Json
          last_verified?: string
          match_score?: number
          match_summary?: string | null
          missing_requirements?: string[]
          partial_matches?: string[]
          publication_date?: string
          recommendation?: string
          red_flags?: string[]
          role_category?: string
          role_title_group?: string | null
          source?: string | null
          status?: string
          strong_matches?: string[]
          title?: string
          transferable_experience?: string[]
          url?: string | null
          work_model?: string
        }
        Relationships: []
      }
      radar_sources: {
        Row: {
          country: string
          created_at: string
          enabled: boolean
          id: string
          jobs_url: string | null
          last_checked_at: string | null
          name: string
          site_url: string | null
          source_category: string
          verification_note: string | null
          verification_status: string
        }
        Insert: {
          country?: string
          created_at?: string
          enabled?: boolean
          id?: string
          jobs_url?: string | null
          last_checked_at?: string | null
          name: string
          site_url?: string | null
          source_category?: string
          verification_note?: string | null
          verification_status?: string
        }
        Update: {
          country?: string
          created_at?: string
          enabled?: boolean
          id?: string
          jobs_url?: string | null
          last_checked_at?: string | null
          name?: string
          site_url?: string | null
          source_category?: string
          verification_note?: string | null
          verification_status?: string
        }
        Relationships: []
      }
      radar_vacancies: {
        Row: {
          city: string | null
          client_company: string
          country: string
          dedupe_key: string
          employment_type: string
          extra_sources: Json
          first_detected_at: string
          id: string
          language_requirement: string
          last_seen_at: string
          matched_skills: string[]
          relevance: string
          relevance_reason: string | null
          relevance_score: number
          role_category: string | null
          source_category: string
          source_name: string
          source_published_at: string | null
          title: string
          url: string
          url_key: string
          verification_status: string
        }
        Insert: {
          city?: string | null
          client_company?: string
          country?: string
          dedupe_key: string
          employment_type?: string
          extra_sources?: Json
          first_detected_at?: string
          id?: string
          language_requirement?: string
          last_seen_at?: string
          matched_skills?: string[]
          relevance?: string
          relevance_reason?: string | null
          relevance_score?: number
          role_category?: string | null
          source_category?: string
          source_name: string
          source_published_at?: string | null
          title: string
          url: string
          url_key: string
          verification_status?: string
        }
        Update: {
          city?: string | null
          client_company?: string
          country?: string
          dedupe_key?: string
          employment_type?: string
          extra_sources?: Json
          first_detected_at?: string
          id?: string
          language_requirement?: string
          last_seen_at?: string
          matched_skills?: string[]
          relevance?: string
          relevance_reason?: string | null
          relevance_score?: number
          role_category?: string | null
          source_category?: string
          source_name?: string
          source_published_at?: string | null
          title?: string
          url?: string
          url_key?: string
          verification_status?: string
        }
        Relationships: []
      }
      search_runs: {
        Row: {
          id: string
          jobs_added: number
          jobs_found: number
          jobs_removed: number
          search_criteria: Json
          search_date: string
        }
        Insert: {
          id?: string
          jobs_added?: number
          jobs_found?: number
          jobs_removed?: number
          search_criteria?: Json
          search_date?: string
        }
        Update: {
          id?: string
          jobs_added?: number
          jobs_found?: number
          jobs_removed?: number
          search_criteria?: Json
          search_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
