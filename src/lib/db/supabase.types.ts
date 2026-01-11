export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      calibration_events: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          change_reason: string | null
          change_trigger: string | null
          confidence_after: string | null
          confidence_before: string | null
          cooldown_ends_at: string | null
          cooldown_reason: string | null
          created_at: string
          data_points_used: number | null
          event_type: string
          id: string
          is_undoable: boolean
          metadata: Json | null
          new_value: Json | null
          notes: string | null
          previous_value: Json | null
          schema_version: string
          source: string
          source_ref: string | null
          threshold_id: string | null
          threshold_type: string
          undo_deadline: string | null
          undo_event_id: string | null
          undone_at: string | null
          updated_at: string
          user_id: string
          was_undone: boolean
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string | null
          change_reason?: string | null
          change_trigger?: string | null
          confidence_after?: string | null
          confidence_before?: string | null
          cooldown_ends_at?: string | null
          cooldown_reason?: string | null
          created_at?: string
          data_points_used?: number | null
          event_type: string
          id?: string
          is_undoable?: boolean
          metadata?: Json | null
          new_value?: Json | null
          notes?: string | null
          previous_value?: Json | null
          schema_version?: string
          source?: string
          source_ref?: string | null
          threshold_id?: string | null
          threshold_type: string
          undo_deadline?: string | null
          undo_event_id?: string | null
          undone_at?: string | null
          updated_at?: string
          user_id: string
          was_undone?: boolean
        }
        Update: {
          actor_id?: string | null
          actor_type?: string | null
          change_reason?: string | null
          change_trigger?: string | null
          confidence_after?: string | null
          confidence_before?: string | null
          cooldown_ends_at?: string | null
          cooldown_reason?: string | null
          created_at?: string
          data_points_used?: number | null
          event_type?: string
          id?: string
          is_undoable?: boolean
          metadata?: Json | null
          new_value?: Json | null
          notes?: string | null
          previous_value?: Json | null
          schema_version?: string
          source?: string
          source_ref?: string | null
          threshold_id?: string | null
          threshold_type?: string
          undo_deadline?: string | null
          undo_event_id?: string | null
          undone_at?: string | null
          updated_at?: string
          user_id?: string
          was_undone?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "calibration_events_threshold_id_fkey"
            columns: ["threshold_id"]
            isOneToOne: false
            referencedRelation: "user_thresholds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calibration_events_undo_event_id_fkey"
            columns: ["undo_event_id"]
            isOneToOne: false
            referencedRelation: "calibration_events"
            referencedColumns: ["id"]
          },
        ]
      }
      canonical_daily_metrics: {
        Row: {
          active_calories: number | null
          active_minutes: number | null
          blood_oxygen_avg: number | null
          body_battery_high: number | null
          body_battery_low: number | null
          body_fat_percent: number | null
          body_water_percent: number | null
          created_at: string
          date: string
          energy_level: number | null
          floors_climbed: number | null
          id: string
          max_heart_rate_observed: number | null
          mood_score: number | null
          muscle_mass_kg: number | null
          notes: string | null
          raw_data: Json | null
          recovery_score: number | null
          respiration_rate: number | null
          resting_heart_rate: number | null
          schema_version: string
          sedentary_minutes: number | null
          soreness_level: number | null
          source: string
          source_ref: string | null
          steps: number | null
          stress_avg: number | null
          stress_max: number | null
          total_calories: number | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          active_calories?: number | null
          active_minutes?: number | null
          blood_oxygen_avg?: number | null
          body_battery_high?: number | null
          body_battery_low?: number | null
          body_fat_percent?: number | null
          body_water_percent?: number | null
          created_at?: string
          date: string
          energy_level?: number | null
          floors_climbed?: number | null
          id?: string
          max_heart_rate_observed?: number | null
          mood_score?: number | null
          muscle_mass_kg?: number | null
          notes?: string | null
          raw_data?: Json | null
          recovery_score?: number | null
          respiration_rate?: number | null
          resting_heart_rate?: number | null
          schema_version?: string
          sedentary_minutes?: number | null
          soreness_level?: number | null
          source?: string
          source_ref?: string | null
          steps?: number | null
          stress_avg?: number | null
          stress_max?: number | null
          total_calories?: number | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          active_calories?: number | null
          active_minutes?: number | null
          blood_oxygen_avg?: number | null
          body_battery_high?: number | null
          body_battery_low?: number | null
          body_fat_percent?: number | null
          body_water_percent?: number | null
          created_at?: string
          date?: string
          energy_level?: number | null
          floors_climbed?: number | null
          id?: string
          max_heart_rate_observed?: number | null
          mood_score?: number | null
          muscle_mass_kg?: number | null
          notes?: string | null
          raw_data?: Json | null
          recovery_score?: number | null
          respiration_rate?: number | null
          resting_heart_rate?: number | null
          schema_version?: string
          sedentary_minutes?: number | null
          soreness_level?: number | null
          source?: string
          source_ref?: string | null
          steps?: number | null
          stress_avg?: number | null
          stress_max?: number | null
          total_calories?: number | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      daily_metrics: {
        Row: {
          body_fat_percentage: number | null
          created_at: string | null
          date: string
          energy_level: number | null
          hrv_ms: number | null
          hydration_liters: number | null
          id: string
          injury_pain_level: number | null
          mood_score: number | null
          notes: string | null
          nutrition_quality: number | null
          resting_heart_rate: number | null
          sleep_hours: number | null
          sleep_quality: number | null
          stress_level: number | null
          updated_at: string | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          body_fat_percentage?: number | null
          created_at?: string | null
          date: string
          energy_level?: number | null
          hrv_ms?: number | null
          hydration_liters?: number | null
          id?: string
          injury_pain_level?: number | null
          mood_score?: number | null
          notes?: string | null
          nutrition_quality?: number | null
          resting_heart_rate?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          stress_level?: number | null
          updated_at?: string | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          body_fat_percentage?: number | null
          created_at?: string | null
          date?: string
          energy_level?: number | null
          hrv_ms?: number | null
          hydration_liters?: number | null
          id?: string
          injury_pain_level?: number | null
          mood_score?: number | null
          notes?: string | null
          nutrition_quality?: number | null
          resting_heart_rate?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          stress_level?: number | null
          updated_at?: string | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      day_status: {
        Row: {
          date: string
          id: string
          notes: string | null
          status: string
          user_id: string
        }
        Insert: {
          date: string
          id?: string
          notes?: string | null
          status: string
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          notes?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_blocks: {
        Row: {
          completed: boolean | null
          created_at: string | null
          date: string
          description: string | null
          discipline: string | null
          duration_minutes: number | null
          id: string
          is_fixed: boolean | null
          source: string | null
          start_time: string | null
          title: string
          user_id: string
          workout_type: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          date: string
          description?: string | null
          discipline?: string | null
          duration_minutes?: number | null
          id?: string
          is_fixed?: boolean | null
          source?: string | null
          start_time?: string | null
          title: string
          user_id: string
          workout_type?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          date?: string
          description?: string | null
          discipline?: string | null
          duration_minutes?: number | null
          id?: string
          is_fixed?: boolean | null
          source?: string | null
          start_time?: string | null
          title?: string
          user_id?: string
          workout_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_blocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_periods: {
        Row: {
          bike_pct: number | null
          created_at: string | null
          end_date: string
          id: string
          name: string | null
          primary_discipline: string | null
          run_pct: number | null
          start_date: string
          strength_pct: number | null
          swim_pct: number | null
          user_id: string
        }
        Insert: {
          bike_pct?: number | null
          created_at?: string | null
          end_date: string
          id?: string
          name?: string | null
          primary_discipline?: string | null
          run_pct?: number | null
          start_date: string
          strength_pct?: number | null
          swim_pct?: number | null
          user_id: string
        }
        Update: {
          bike_pct?: number | null
          created_at?: string | null
          end_date?: string
          id?: string
          name?: string | null
          primary_discipline?: string | null
          run_pct?: number | null
          start_date?: string
          strength_pct?: number | null
          swim_pct?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_periods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string | null
          description: string | null
          goal_type: string | null
          id: string
          status: Database["public"]["Enums"]["goal_status"] | null
          target_date: string | null
          target_unit: string | null
          target_value: number | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          goal_type?: string | null
          id?: string
          status?: Database["public"]["Enums"]["goal_status"] | null
          target_date?: string | null
          target_unit?: string | null
          target_value?: number | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          goal_type?: string | null
          id?: string
          status?: Database["public"]["Enums"]["goal_status"] | null
          target_date?: string | null
          target_unit?: string | null
          target_value?: number | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hrv_nights: {
        Row: {
          avg_heart_rate: number | null
          created_at: string
          date: string
          hrv_baseline: number | null
          hrv_rmssd: number | null
          hrv_sdrr: number | null
          hrv_status: string | null
          id: string
          measurement_end: string | null
          measurement_start: string | null
          notes: string | null
          raw_data: Json | null
          reading_count: number | null
          respiratory_rate: number | null
          schema_version: string
          seven_day_change_percent: number | null
          source: string
          source_ref: string | null
          updated_at: string
          user_id: string
          weekly_avg: number | null
        }
        Insert: {
          avg_heart_rate?: number | null
          created_at?: string
          date: string
          hrv_baseline?: number | null
          hrv_rmssd?: number | null
          hrv_sdrr?: number | null
          hrv_status?: string | null
          id?: string
          measurement_end?: string | null
          measurement_start?: string | null
          notes?: string | null
          raw_data?: Json | null
          reading_count?: number | null
          respiratory_rate?: number | null
          schema_version?: string
          seven_day_change_percent?: number | null
          source?: string
          source_ref?: string | null
          updated_at?: string
          user_id: string
          weekly_avg?: number | null
        }
        Update: {
          avg_heart_rate?: number | null
          created_at?: string
          date?: string
          hrv_baseline?: number | null
          hrv_rmssd?: number | null
          hrv_sdrr?: number | null
          hrv_status?: string | null
          id?: string
          measurement_end?: string | null
          measurement_start?: string | null
          notes?: string | null
          raw_data?: Json | null
          reading_count?: number | null
          respiratory_rate?: number | null
          schema_version?: string
          seven_day_change_percent?: number | null
          source?: string
          source_ref?: string | null
          updated_at?: string
          user_id?: string
          weekly_avg?: number | null
        }
        Relationships: []
      }
      integration_connections: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          backfill_days: number | null
          connected_at: string | null
          consecutive_errors: number
          created_at: string
          disconnected_at: string | null
          id: string
          last_error_at: string | null
          last_error_message: string | null
          last_successful_sync: string | null
          metadata: Json | null
          notes: string | null
          oauth_state: string | null
          provider: string
          provider_profile: Json | null
          provider_user_id: string | null
          refresh_token: string | null
          refresh_token_expires_at: string | null
          schema_version: string
          scopes: string[] | null
          source: string
          source_ref: string | null
          status: string
          sync_daily_metrics: boolean
          sync_enabled: boolean
          sync_hrv: boolean
          sync_sleep: boolean
          sync_workouts: boolean
          token_type: string | null
          updated_at: string
          user_id: string
          webhook_enabled: boolean
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          backfill_days?: number | null
          connected_at?: string | null
          consecutive_errors?: number
          created_at?: string
          disconnected_at?: string | null
          id?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_successful_sync?: string | null
          metadata?: Json | null
          notes?: string | null
          oauth_state?: string | null
          provider: string
          provider_profile?: Json | null
          provider_user_id?: string | null
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          schema_version?: string
          scopes?: string[] | null
          source?: string
          source_ref?: string | null
          status?: string
          sync_daily_metrics?: boolean
          sync_enabled?: boolean
          sync_hrv?: boolean
          sync_sleep?: boolean
          sync_workouts?: boolean
          token_type?: string | null
          updated_at?: string
          user_id: string
          webhook_enabled?: boolean
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          backfill_days?: number | null
          connected_at?: string | null
          consecutive_errors?: number
          created_at?: string
          disconnected_at?: string | null
          id?: string
          last_error_at?: string | null
          last_error_message?: string | null
          last_successful_sync?: string | null
          metadata?: Json | null
          notes?: string | null
          oauth_state?: string | null
          provider?: string
          provider_profile?: Json | null
          provider_user_id?: string | null
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          schema_version?: string
          scopes?: string[] | null
          source?: string
          source_ref?: string | null
          status?: string
          sync_daily_metrics?: boolean
          sync_enabled?: boolean
          sync_hrv?: boolean
          sync_sleep?: boolean
          sync_workouts?: boolean
          token_type?: string | null
          updated_at?: string
          user_id?: string
          webhook_enabled?: boolean
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      phases: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          name: string
          start_date: string
          type: string
          user_id: string
          weekly_hours_target: number | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
          type: string
          user_id: string
          weekly_hours_target?: number | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          type?: string
          user_id?: string
          weekly_hours_target?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "phases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_workouts: {
        Row: {
          created_at: string | null
          description: string | null
          distance_km: number | null
          goal_id: string | null
          id: string
          intensity_level: number | null
          notes: string | null
          planned_date: string
          planned_duration_minutes: number | null
          title: string
          training_phase: Database["public"]["Enums"]["training_phase"] | null
          updated_at: string | null
          user_id: string
          workout_type: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          distance_km?: number | null
          goal_id?: string | null
          id?: string
          intensity_level?: number | null
          notes?: string | null
          planned_date: string
          planned_duration_minutes?: number | null
          title: string
          training_phase?: Database["public"]["Enums"]["training_phase"] | null
          updated_at?: string | null
          user_id: string
          workout_type?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          distance_km?: number | null
          goal_id?: string | null
          id?: string
          intensity_level?: number | null
          notes?: string | null
          planned_date?: string
          planned_duration_minutes?: number | null
          title?: string
          training_phase?: Database["public"]["Enums"]["training_phase"] | null
          updated_at?: string | null
          user_id?: string
          workout_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planned_workouts_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          experience_level: string | null
          id: string
          injury_notes: string | null
          name: string | null
          weekly_hours_available: number | null
        }
        Insert: {
          created_at?: string | null
          experience_level?: string | null
          id: string
          injury_notes?: string | null
          name?: string | null
          weekly_hours_available?: number | null
        }
        Update: {
          created_at?: string | null
          experience_level?: string | null
          id?: string
          injury_notes?: string | null
          name?: string | null
          weekly_hours_available?: number | null
        }
        Relationships: []
      }
      races: {
        Row: {
          created_at: string | null
          date: string
          distance_km: number | null
          goal_type: string | null
          goal_value: string | null
          id: string
          name: string
          priority: string
          sport: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          distance_km?: number | null
          goal_type?: string | null
          goal_value?: string | null
          id?: string
          name: string
          priority: string
          sport: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          distance_km?: number | null
          goal_type?: string | null
          goal_value?: string | null
          id?: string
          name?: string
          priority?: string
          sport?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "races_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendation_events: {
        Row: {
          algorithm_inputs: Json | null
          algorithm_version: string | null
          alternatives_shown: Json | null
          confidence_score: number | null
          created_at: string
          id: string
          learning_signals: Json | null
          metadata: Json | null
          outcome_data: Json | null
          outcome_recorded_at: string | null
          outcome_type: string | null
          recommendation_data: Json
          recommendation_date: string
          recommendation_summary: string
          recommendation_type: string
          response_at: string | null
          response_type: string | null
          schema_version: string
          shown_at: string | null
          source: string
          source_ref: string | null
          updated_at: string
          user_choice: Json | null
          user_feedback: string | null
          user_id: string
          user_rating: number | null
          was_good_recommendation: boolean | null
          workout_id: string | null
        }
        Insert: {
          algorithm_inputs?: Json | null
          algorithm_version?: string | null
          alternatives_shown?: Json | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          learning_signals?: Json | null
          metadata?: Json | null
          outcome_data?: Json | null
          outcome_recorded_at?: string | null
          outcome_type?: string | null
          recommendation_data: Json
          recommendation_date: string
          recommendation_summary: string
          recommendation_type: string
          response_at?: string | null
          response_type?: string | null
          schema_version?: string
          shown_at?: string | null
          source?: string
          source_ref?: string | null
          updated_at?: string
          user_choice?: Json | null
          user_feedback?: string | null
          user_id: string
          user_rating?: number | null
          was_good_recommendation?: boolean | null
          workout_id?: string | null
        }
        Update: {
          algorithm_inputs?: Json | null
          algorithm_version?: string | null
          alternatives_shown?: Json | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          learning_signals?: Json | null
          metadata?: Json | null
          outcome_data?: Json | null
          outcome_recorded_at?: string | null
          outcome_type?: string | null
          recommendation_data?: Json
          recommendation_date?: string
          recommendation_summary?: string
          recommendation_type?: string
          response_at?: string | null
          response_type?: string | null
          schema_version?: string
          shown_at?: string | null
          source?: string
          source_ref?: string | null
          updated_at?: string
          user_choice?: Json | null
          user_feedback?: string | null
          user_id?: string
          user_rating?: number | null
          was_good_recommendation?: boolean | null
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_events_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      sleep_sessions: {
        Row: {
          avg_blood_oxygen: number | null
          avg_heart_rate: number | null
          avg_hrv_ms: number | null
          avg_respiration_rate: number | null
          avg_stress: number | null
          awake_seconds: number | null
          awakenings: number | null
          created_at: string
          date: string
          deep_seconds: number | null
          duration_seconds: number | null
          efficiency_percent: number | null
          id: string
          latency_seconds: number | null
          light_seconds: number | null
          min_heart_rate: number | null
          notes: string | null
          quality_rating: number | null
          raw_data: Json | null
          rem_seconds: number | null
          schema_version: string
          sleep_end: string
          sleep_score: number | null
          sleep_start: string
          source: string
          source_ref: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_blood_oxygen?: number | null
          avg_heart_rate?: number | null
          avg_hrv_ms?: number | null
          avg_respiration_rate?: number | null
          avg_stress?: number | null
          awake_seconds?: number | null
          awakenings?: number | null
          created_at?: string
          date: string
          deep_seconds?: number | null
          duration_seconds?: number | null
          efficiency_percent?: number | null
          id?: string
          latency_seconds?: number | null
          light_seconds?: number | null
          min_heart_rate?: number | null
          notes?: string | null
          quality_rating?: number | null
          raw_data?: Json | null
          rem_seconds?: number | null
          schema_version?: string
          sleep_end: string
          sleep_score?: number | null
          sleep_start: string
          source?: string
          source_ref?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_blood_oxygen?: number | null
          avg_heart_rate?: number | null
          avg_hrv_ms?: number | null
          avg_respiration_rate?: number | null
          avg_stress?: number | null
          awake_seconds?: number | null
          awakenings?: number | null
          created_at?: string
          date?: string
          deep_seconds?: number | null
          duration_seconds?: number | null
          efficiency_percent?: number | null
          id?: string
          latency_seconds?: number | null
          light_seconds?: number | null
          min_heart_rate?: number | null
          notes?: string | null
          quality_rating?: number | null
          raw_data?: Json | null
          rem_seconds?: number | null
          schema_version?: string
          sleep_end?: string
          sleep_score?: number | null
          sleep_start?: string
          source?: string
          source_ref?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_state: {
        Row: {
          backfill_completed: boolean
          backfill_completed_at: string | null
          backfill_from_date: string | null
          backfill_started_at: string | null
          connection_id: string | null
          created_at: string
          data_type: string
          id: string
          last_error_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          last_sync_completed_at: string | null
          last_sync_cursor: string | null
          last_sync_date: string | null
          last_sync_duration_ms: number | null
          last_sync_id: string | null
          last_sync_records_created: number | null
          last_sync_records_fetched: number | null
          last_sync_records_skipped: number | null
          last_sync_records_updated: number | null
          last_sync_started_at: string | null
          last_sync_timestamp: string | null
          metadata: Json | null
          next_retry_at: string | null
          provider: string
          rate_limit_remaining: number | null
          rate_limit_reset_at: string | null
          retry_count: number
          schema_version: string
          source: string
          source_ref: string | null
          sync_from_date: string | null
          sync_status: string
          sync_to_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          backfill_completed?: boolean
          backfill_completed_at?: string | null
          backfill_from_date?: string | null
          backfill_started_at?: string | null
          connection_id?: string | null
          created_at?: string
          data_type: string
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          last_sync_completed_at?: string | null
          last_sync_cursor?: string | null
          last_sync_date?: string | null
          last_sync_duration_ms?: number | null
          last_sync_id?: string | null
          last_sync_records_created?: number | null
          last_sync_records_fetched?: number | null
          last_sync_records_skipped?: number | null
          last_sync_records_updated?: number | null
          last_sync_started_at?: string | null
          last_sync_timestamp?: string | null
          metadata?: Json | null
          next_retry_at?: string | null
          provider: string
          rate_limit_remaining?: number | null
          rate_limit_reset_at?: string | null
          retry_count?: number
          schema_version?: string
          source?: string
          source_ref?: string | null
          sync_from_date?: string | null
          sync_status?: string
          sync_to_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          backfill_completed?: boolean
          backfill_completed_at?: string | null
          backfill_from_date?: string | null
          backfill_started_at?: string | null
          connection_id?: string | null
          created_at?: string
          data_type?: string
          id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          last_sync_completed_at?: string | null
          last_sync_cursor?: string | null
          last_sync_date?: string | null
          last_sync_duration_ms?: number | null
          last_sync_id?: string | null
          last_sync_records_created?: number | null
          last_sync_records_fetched?: number | null
          last_sync_records_skipped?: number | null
          last_sync_records_updated?: number | null
          last_sync_started_at?: string | null
          last_sync_timestamp?: string | null
          metadata?: Json | null
          next_retry_at?: string | null
          provider?: string
          rate_limit_remaining?: number | null
          rate_limit_reset_at?: string | null
          retry_count?: number
          schema_version?: string
          source?: string
          source_ref?: string | null
          sync_from_date?: string | null
          sync_status?: string
          sync_to_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_state_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      training_load: {
        Row: {
          acute_chronic_ratio: number | null
          acute_load: number | null
          chronic_load: number | null
          created_at: string | null
          date: string
          fatigue_score: number | null
          fitness_score: number | null
          form_score: number | null
          id: string
          monotony_score: number | null
          strain_score: number | null
          training_stress_score: number | null
          updated_at: string | null
          user_id: string
          week_number: number
          weekly_distance_km: number | null
          weekly_duration_minutes: number | null
          weekly_elevation_m: number | null
          weekly_workout_count: number | null
          year: number
        }
        Insert: {
          acute_chronic_ratio?: number | null
          acute_load?: number | null
          chronic_load?: number | null
          created_at?: string | null
          date: string
          fatigue_score?: number | null
          fitness_score?: number | null
          form_score?: number | null
          id?: string
          monotony_score?: number | null
          strain_score?: number | null
          training_stress_score?: number | null
          updated_at?: string | null
          user_id: string
          week_number: number
          weekly_distance_km?: number | null
          weekly_duration_minutes?: number | null
          weekly_elevation_m?: number | null
          weekly_workout_count?: number | null
          year: number
        }
        Update: {
          acute_chronic_ratio?: number | null
          acute_load?: number | null
          chronic_load?: number | null
          created_at?: string | null
          date?: string
          fatigue_score?: number | null
          fitness_score?: number | null
          form_score?: number | null
          id?: string
          monotony_score?: number | null
          strain_score?: number | null
          training_stress_score?: number | null
          updated_at?: string | null
          user_id?: string
          week_number?: number
          weekly_distance_km?: number | null
          weekly_duration_minutes?: number | null
          weekly_elevation_m?: number | null
          weekly_workout_count?: number | null
          year?: number
        }
        Relationships: []
      }
      user_flags: {
        Row: {
          created_at: string
          disabled_at: string | null
          enabled_at: string | null
          expires_at: string | null
          flag_key: string
          flag_value: boolean
          id: string
          reason: string | null
          schema_version: string
          source: string
          source_ref: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disabled_at?: string | null
          enabled_at?: string | null
          expires_at?: string | null
          flag_key: string
          flag_value?: boolean
          id?: string
          reason?: string | null
          schema_version?: string
          source?: string
          source_ref?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disabled_at?: string | null
          enabled_at?: string | null
          expires_at?: string | null
          flag_key?: string
          flag_value?: boolean
          id?: string
          reason?: string | null
          schema_version?: string
          source?: string
          source_ref?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          allow_coach_access: boolean
          created_at: string
          dashboard_layout: string | null
          distance_unit: string
          extended_prefs: Json | null
          id: string
          locale: string
          notify_daily_recommendation: boolean
          notify_goal_progress: boolean
          notify_recovery_alerts: boolean
          notify_weekly_summary: boolean
          pace_unit: string
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          schema_version: string
          share_workouts_publicly: boolean
          show_raw_metrics: boolean
          source: string
          source_ref: string | null
          temperature_unit: string
          theme: string | null
          timezone: string
          updated_at: string
          user_id: string
          week_start_day: number
          weight_unit: string
        }
        Insert: {
          allow_coach_access?: boolean
          created_at?: string
          dashboard_layout?: string | null
          distance_unit?: string
          extended_prefs?: Json | null
          id?: string
          locale?: string
          notify_daily_recommendation?: boolean
          notify_goal_progress?: boolean
          notify_recovery_alerts?: boolean
          notify_weekly_summary?: boolean
          pace_unit?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          schema_version?: string
          share_workouts_publicly?: boolean
          show_raw_metrics?: boolean
          source?: string
          source_ref?: string | null
          temperature_unit?: string
          theme?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
          week_start_day?: number
          weight_unit?: string
        }
        Update: {
          allow_coach_access?: boolean
          created_at?: string
          dashboard_layout?: string | null
          distance_unit?: string
          extended_prefs?: Json | null
          id?: string
          locale?: string
          notify_daily_recommendation?: boolean
          notify_goal_progress?: boolean
          notify_recovery_alerts?: boolean
          notify_weekly_summary?: boolean
          pace_unit?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          schema_version?: string
          share_workouts_publicly?: boolean
          show_raw_metrics?: boolean
          source?: string
          source_ref?: string | null
          temperature_unit?: string
          theme?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
          week_start_day?: number
          weight_unit?: string
        }
        Relationships: []
      }
      user_thresholds: {
        Row: {
          calibration_method: string | null
          confidence_level: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          is_locked: boolean
          last_calibrated_at: string | null
          lock_expires_at: string | null
          locked_at: string | null
          locked_reason: string | null
          notes: string | null
          schema_version: string
          source: string
          source_ref: string | null
          threshold_type: string
          updated_at: string
          user_id: string
          value_json: Json | null
          value_max: number | null
          value_min: number | null
          value_numeric: number | null
          value_unit: string | null
        }
        Insert: {
          calibration_method?: string | null
          confidence_level?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_locked?: boolean
          last_calibrated_at?: string | null
          lock_expires_at?: string | null
          locked_at?: string | null
          locked_reason?: string | null
          notes?: string | null
          schema_version?: string
          source?: string
          source_ref?: string | null
          threshold_type: string
          updated_at?: string
          user_id: string
          value_json?: Json | null
          value_max?: number | null
          value_min?: number | null
          value_numeric?: number | null
          value_unit?: string | null
        }
        Update: {
          calibration_method?: string | null
          confidence_level?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_locked?: boolean
          last_calibrated_at?: string | null
          lock_expires_at?: string | null
          locked_at?: string | null
          locked_reason?: string | null
          notes?: string | null
          schema_version?: string
          source?: string
          source_ref?: string | null
          threshold_type?: string
          updated_at?: string
          user_id?: string
          value_json?: Json | null
          value_max?: number | null
          value_min?: number | null
          value_numeric?: number | null
          value_unit?: string | null
        }
        Relationships: []
      }
      weekly_availability: {
        Row: {
          created_at: string | null
          day_of_week: number
          id: string
          minutes: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          id?: string
          minutes?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          id?: string
          minutes?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_completions: {
        Row: {
          actual_duration_minutes: number | null
          average_heart_rate: number | null
          average_pace_min_per_km: number | null
          average_speed_kmh: number | null
          calories_burned: number | null
          completed_at: string | null
          completed_date: string
          created_at: string | null
          data_source: string | null
          distance_km: number | null
          elevation_gain_m: number | null
          external_id: string | null
          id: string
          max_heart_rate: number | null
          notes: string | null
          perceived_effort: number | null
          planned_workout_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["workout_status"] | null
          temperature_celsius: number | null
          title: string
          updated_at: string | null
          user_id: string
          weather_conditions: string | null
          workout_type: string | null
        }
        Insert: {
          actual_duration_minutes?: number | null
          average_heart_rate?: number | null
          average_pace_min_per_km?: number | null
          average_speed_kmh?: number | null
          calories_burned?: number | null
          completed_at?: string | null
          completed_date: string
          created_at?: string | null
          data_source?: string | null
          distance_km?: number | null
          elevation_gain_m?: number | null
          external_id?: string | null
          id?: string
          max_heart_rate?: number | null
          notes?: string | null
          perceived_effort?: number | null
          planned_workout_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["workout_status"] | null
          temperature_celsius?: number | null
          title: string
          updated_at?: string | null
          user_id: string
          weather_conditions?: string | null
          workout_type?: string | null
        }
        Update: {
          actual_duration_minutes?: number | null
          average_heart_rate?: number | null
          average_pace_min_per_km?: number | null
          average_speed_kmh?: number | null
          calories_burned?: number | null
          completed_at?: string | null
          completed_date?: string
          created_at?: string | null
          data_source?: string | null
          distance_km?: number | null
          elevation_gain_m?: number | null
          external_id?: string | null
          id?: string
          max_heart_rate?: number | null
          notes?: string | null
          perceived_effort?: number | null
          planned_workout_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["workout_status"] | null
          temperature_celsius?: number | null
          title?: string
          updated_at?: string | null
          user_id?: string
          weather_conditions?: string | null
          workout_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_completions_planned_workout_id_fkey"
            columns: ["planned_workout_id"]
            isOneToOne: false
            referencedRelation: "planned_workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          activity_subtype: string | null
          activity_type: string
          avg_cadence: number | null
          avg_heart_rate: number | null
          avg_power_watts: number | null
          calories: number | null
          created_at: string
          distance_meters: number | null
          duration_seconds: number | null
          elevation_gain_meters: number | null
          elevation_loss_meters: number | null
          ended_at: string | null
          feeling_score: number | null
          humidity_percent: number | null
          id: string
          intensity_factor: number | null
          max_cadence: number | null
          max_heart_rate: number | null
          max_power_watts: number | null
          min_heart_rate: number | null
          normalized_power_watts: number | null
          notes: string | null
          perceived_exertion: number | null
          raw_data: Json | null
          schema_version: string
          source: string
          source_ref: string | null
          started_at: string
          temperature_celsius: number | null
          title: string | null
          training_stress_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_subtype?: string | null
          activity_type: string
          avg_cadence?: number | null
          avg_heart_rate?: number | null
          avg_power_watts?: number | null
          calories?: number | null
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number | null
          elevation_gain_meters?: number | null
          elevation_loss_meters?: number | null
          ended_at?: string | null
          feeling_score?: number | null
          humidity_percent?: number | null
          id?: string
          intensity_factor?: number | null
          max_cadence?: number | null
          max_heart_rate?: number | null
          max_power_watts?: number | null
          min_heart_rate?: number | null
          normalized_power_watts?: number | null
          notes?: string | null
          perceived_exertion?: number | null
          raw_data?: Json | null
          schema_version?: string
          source?: string
          source_ref?: string | null
          started_at: string
          temperature_celsius?: number | null
          title?: string | null
          training_stress_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_subtype?: string | null
          activity_type?: string
          avg_cadence?: number | null
          avg_heart_rate?: number | null
          avg_power_watts?: number | null
          calories?: number | null
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number | null
          elevation_gain_meters?: number | null
          elevation_loss_meters?: number | null
          ended_at?: string | null
          feeling_score?: number | null
          humidity_percent?: number | null
          id?: string
          intensity_factor?: number | null
          max_cadence?: number | null
          max_heart_rate?: number | null
          max_power_watts?: number | null
          min_heart_rate?: number | null
          normalized_power_watts?: number | null
          notes?: string | null
          perceived_exertion?: number | null
          raw_data?: Json | null
          schema_version?: string
          source?: string
          source_ref?: string | null
          started_at?: string
          temperature_celsius?: number | null
          title?: string | null
          training_stress_score?: number | null
          updated_at?: string
          user_id?: string
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
      goal_status: "active" | "completed" | "paused" | "cancelled"
      training_phase: "base" | "build" | "peak" | "recovery" | "transition"
      workout_status: "planned" | "completed" | "skipped" | "partial"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      goal_status: ["active", "completed", "paused", "cancelled"],
      training_phase: ["base", "build", "peak", "recovery", "transition"],
      workout_status: ["planned", "completed", "skipped", "partial"],
    },
  },
} as const

