// Generated from the live database schema: `npm run db:types`. Do not edit.
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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      availability: {
        Row: {
          barber_id: string
          day_of_week: number | null
          end_time: string
          id: string
          specific_date: string | null
          start_time: string
        }
        Insert: {
          barber_id: string
          day_of_week?: number | null
          end_time: string
          id?: string
          specific_date?: string | null
          start_time: string
        }
        Update: {
          barber_id?: string
          day_of_week?: number | null
          end_time?: string
          id?: string
          specific_date?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_days_off: {
        Row: {
          barber_id: string
          created_at: string
          day: string
        }
        Insert: {
          barber_id: string
          created_at?: string
          day: string
        }
        Update: {
          barber_id?: string
          created_at?: string
          day?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_days_off_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_location: {
        Row: {
          address: string | null
          display_latitude: number | null
          display_longitude: number | null
          latitude: number | null
          location_updated_at: string | null
          longitude: number | null
          user_id: string
        }
        Insert: {
          address?: string | null
          display_latitude?: number | null
          display_longitude?: number | null
          latitude?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          user_id: string
        }
        Update: {
          address?: string | null
          display_latitude?: number | null
          display_longitude?: number | null
          latitude?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_location_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_profile: {
        Row: {
          bio: string | null
          id: string
          rating: number
          user_id: string
          verification_status: Database["public"]["Enums"]["verification_status_type"]
          verified: boolean
        }
        Insert: {
          bio?: string | null
          id?: string
          rating?: number
          user_id: string
          verification_status?: Database["public"]["Enums"]["verification_status_type"]
          verified?: boolean
        }
        Update: {
          bio?: string | null
          id?: string
          rating?: number
          user_id?: string
          verification_status?: Database["public"]["Enums"]["verification_status_type"]
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "barber_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_public_profile: {
        Row: {
          approved: boolean
          barber_id: string
          bio: string | null
          city: string | null
          country: string | null
          display_latitude: number | null
          display_longitude: number | null
          name: string | null
          profile_image: string | null
          rating: number
          updated_at: string
          verified: boolean
        }
        Insert: {
          approved?: boolean
          barber_id: string
          bio?: string | null
          city?: string | null
          country?: string | null
          display_latitude?: number | null
          display_longitude?: number | null
          name?: string | null
          profile_image?: string | null
          rating?: number
          updated_at?: string
          verified?: boolean
        }
        Update: {
          approved?: boolean
          barber_id?: string
          bio?: string | null
          city?: string | null
          country?: string | null
          display_latitude?: number | null
          display_longitude?: number | null
          name?: string | null
          profile_image?: string | null
          rating?: number
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "barber_public_profile_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_stats: {
        Row: {
          barber_id: string
          completed_count: number
          computed_at: string
          median_response_minutes: number | null
          popular_hours: Json | null
          popular_samples: number
          repeat_client_rate: number | null
          response_samples: number
        }
        Insert: {
          barber_id: string
          completed_count?: number
          computed_at?: string
          median_response_minutes?: number | null
          popular_hours?: Json | null
          popular_samples?: number
          repeat_client_rate?: number | null
          response_samples?: number
        }
        Update: {
          barber_id?: string
          completed_count?: number
          computed_at?: string
          median_response_minutes?: number | null
          popular_hours?: Json | null
          popular_samples?: number
          repeat_client_rate?: number | null
          response_samples?: number
        }
        Relationships: [
          {
            foreignKeyName: "barber_stats_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_trips: {
        Row: {
          accuracy_m: number | null
          arrived_at: string | null
          arriving_notified_at: string | null
          barber_id: string
          booking_id: string
          customer_id: string
          dest_latitude: number | null
          dest_longitude: number | null
          ended_at: string | null
          eta_at: string | null
          heading: number | null
          latitude: number | null
          longitude: number | null
          position_at: string | null
          remaining_distance_m: number | null
          route_polyline: string | null
          route_source: string | null
          speed_mps: number | null
          started_at: string
          status: Database["public"]["Enums"]["trip_status_type"]
          updated_at: string
        }
        Insert: {
          accuracy_m?: number | null
          arrived_at?: string | null
          arriving_notified_at?: string | null
          barber_id: string
          booking_id: string
          customer_id: string
          dest_latitude?: number | null
          dest_longitude?: number | null
          ended_at?: string | null
          eta_at?: string | null
          heading?: number | null
          latitude?: number | null
          longitude?: number | null
          position_at?: string | null
          remaining_distance_m?: number | null
          route_polyline?: string | null
          route_source?: string | null
          speed_mps?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["trip_status_type"]
          updated_at?: string
        }
        Update: {
          accuracy_m?: number | null
          arrived_at?: string | null
          arriving_notified_at?: string | null
          barber_id?: string
          booking_id?: string
          customer_id?: string
          dest_latitude?: number | null
          dest_longitude?: number | null
          ended_at?: string | null
          eta_at?: string | null
          heading?: number | null
          latitude?: number | null
          longitude?: number | null
          position_at?: string | null
          remaining_distance_m?: number | null
          route_polyline?: string | null
          route_source?: string | null
          speed_mps?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["trip_status_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_trips_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_trips_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_trips_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          barber_id: string | null
          created_at: string
          customer_id: string | null
          date: string
          duration_minutes: number
          id: string
          idempotency_key: string | null
          location: string
          location_latitude: number | null
          location_longitude: number | null
          price: number
          service_id: string | null
          slot: unknown
          status: Database["public"]["Enums"]["booking_status_type"]
          time: string
        }
        Insert: {
          barber_id?: string | null
          created_at?: string
          customer_id?: string | null
          date: string
          duration_minutes: number
          id?: string
          idempotency_key?: string | null
          location: string
          location_latitude?: number | null
          location_longitude?: number | null
          price: number
          service_id?: string | null
          slot?: unknown
          status?: Database["public"]["Enums"]["booking_status_type"]
          time: string
        }
        Update: {
          barber_id?: string | null
          created_at?: string
          customer_id?: string | null
          date?: string
          duration_minutes?: number
          id?: string
          idempotency_key?: string | null
          location?: string
          location_latitude?: number | null
          location_longitude?: number | null
          price?: number
          service_id?: string | null
          slot?: unknown
          status?: Database["public"]["Enums"]["booking_status_type"]
          time?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_read_state: {
        Row: {
          chat_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_read_state_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_read_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          barber_id: string | null
          booking_id: string
          customer_id: string | null
          id: string
        }
        Insert: {
          barber_id?: string | null
          booking_id: string
          customer_id?: string | null
          id?: string
        }
        Update: {
          barber_id?: string | null
          booking_id?: string
          customer_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address: string
          created_at: string
          customer_id: string
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          customer_id: string
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          customer_id?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_favorites: {
        Row: {
          barber_id: string
          created_at: string
          customer_id: string
        }
        Insert: {
          barber_id: string
          created_at?: string
          customer_id: string
        }
        Update: {
          barber_id?: string
          created_at?: string
          customer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_favorites_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_favorites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_consent_history: {
        Row: {
          accepted_at: string
          adult_confirmed: boolean
          id: string
          privacy_version: string
          role: Database["public"]["Enums"]["user_role"]
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          adult_confirmed: boolean
          id?: string
          privacy_version: string
          role: Database["public"]["Enums"]["user_role"]
          terms_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          adult_confirmed?: boolean
          id?: string
          privacy_version?: string
          role?: Database["public"]["Enums"]["user_role"]
          terms_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_consent_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_current_versions: {
        Row: {
          barber_terms_version: string
          customer_terms_version: string
          privacy_version: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          barber_terms_version: string
          customer_terms_version: string
          privacy_version: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          barber_terms_version?: string
          customer_terms_version?: string
          privacy_version?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          chat_id: string
          created_at: string
          id: string
          message: string
          sender_id: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string
          id?: string
          message: string
          sender_id?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string
          id?: string
          message?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          booking_id: string
          booking_status:
            | Database["public"]["Enums"]["booking_status_type"]
            | null
          created_at: string
          event_key: string
          event_type: string
          id: string
          message_id: string | null
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          booking_status?:
            | Database["public"]["Enums"]["booking_status_type"]
            | null
          created_at?: string
          event_key: string
          event_type: string
          id?: string
          message_id?: string | null
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          booking_status?:
            | Database["public"]["Enums"]["booking_status_type"]
            | null
          created_at?: string
          event_key?: string
          event_type?: string
          id?: string
          message_id?: string | null
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio: {
        Row: {
          barber_id: string
          id: string
          image_url: string
        }
        Insert: {
          barber_id: string
          id?: string
          image_url: string
        }
        Update: {
          barber_id?: string
          id?: string
          image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          language: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          language?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          language?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          barber_id: string | null
          booking_id: string
          comment: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          rating: number
        }
        Insert: {
          barber_id?: string | null
          booking_id: string
          comment?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          rating: number
        }
        Update: {
          barber_id?: string | null
          booking_id?: string
          comment?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_events: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          kind: string
          latitude: number | null
          longitude: number | null
          user_id: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          kind: string
          latitude?: number | null
          longitude?: number | null
          user_id?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          kind?: string
          latitude?: number | null
          longitude?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          barber_id: string
          duration_minutes: number
          id: string
          name: string
          price: number
        }
        Insert: {
          barber_id: string
          duration_minutes: number
          id?: string
          name: string
          price: number
        }
        Update: {
          barber_id?: string
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reports: {
        Row: {
          booking_id: string | null
          created_at: string
          details: string | null
          id: string
          reason: string
          reported_id: string | null
          reporter_id: string | null
          target_excerpt: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reported_id?: string | null
          reporter_id?: string | null
          target_excerpt?: string | null
          target_id?: string | null
          target_type?: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reported_id?: string | null
          reporter_id?: string | null
          target_excerpt?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reported_id_fkey"
            columns: ["reported_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          accepted_privacy_version: string | null
          accepted_terms_version: string | null
          adult_confirmed_at: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string
          id: string
          legal_accepted_at: string | null
          name: string
          phone: string | null
          profile_image: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          accepted_privacy_version?: string | null
          accepted_terms_version?: string | null
          adult_confirmed_at?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email: string
          id: string
          legal_accepted_at?: string | null
          name: string
          phone?: string | null
          profile_image?: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          accepted_privacy_version?: string | null
          accepted_terms_version?: string | null
          adult_confirmed_at?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string
          id?: string
          legal_accepted_at?: string | null
          name?: string
          phone?: string | null
          profile_image?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          id: string
          id_image_url: string | null
          license_image_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status_type"]
          user_id: string
        }
        Insert: {
          id?: string
          id_image_url?: string | null
          license_image_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status_type"]
          user_id: string
        }
        Update: {
          id?: string
          id_image_url?: string | null
          license_image_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          city: string | null
          created_at: string
          details: Json | null
          email: string
          first_name: string | null
          id: string
          phone: string | null
          role: string
          source: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          details?: Json | null
          email: string
          first_name?: string | null
          id?: string
          phone?: string | null
          role: string
          source?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          details?: Json | null
          email?: string
          first_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      barber_directory: {
        Row: {
          bio: string | null
          city: string | null
          country: string | null
          display_latitude: number | null
          display_longitude: number | null
          id: string | null
          name: string | null
          profile_image: string | null
          rating: number | null
          verified: boolean | null
        }
        Insert: {
          bio?: string | null
          city?: string | null
          country?: string | null
          display_latitude?: number | null
          display_longitude?: number | null
          id?: string | null
          name?: string | null
          profile_image?: string | null
          rating?: number | null
          verified?: boolean | null
        }
        Update: {
          bio?: string | null
          city?: string | null
          country?: string | null
          display_latitude?: number | null
          display_longitude?: number | null
          id?: string | null
          name?: string | null
          profile_image?: string | null
          rating?: number | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "barber_public_profile_barber_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_current_legal_consent: {
        Args: { p_confirmed_adult?: boolean }
        Returns: undefined
      }
      assert_trip_allowed: {
        Args: { p_booking_id: string }
        Returns: {
          barber_id: string | null
          created_at: string
          customer_id: string | null
          date: string
          duration_minutes: number
          id: string
          idempotency_key: string | null
          location: string
          location_latitude: number | null
          location_longitude: number | null
          price: number
          service_id: string | null
          slot: unknown
          status: Database["public"]["Enums"]["booking_status_type"]
          time: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_booking: {
        Args: {
          p_date: string
          p_idempotency_key: string
          p_latitude?: number
          p_location: string
          p_longitude?: number
          p_service_id: string
          p_time: string
        }
        Returns: {
          barber_id: string | null
          created_at: string
          customer_id: string | null
          date: string
          duration_minutes: number
          id: string
          idempotency_key: string | null
          location: string
          location_latitude: number | null
          location_longitude: number | null
          price: number
          service_id: string | null
          slot: unknown
          status: Database["public"]["Enums"]["booking_status_type"]
          time: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_own_account: { Args: never; Returns: undefined }
      end_trip: { Args: { p_booking_id: string }; Returns: undefined }
      get_barber_busy_slots: {
        Args: { p_barber_id: string; p_date: string }
        Returns: {
          duration_minutes: number
          start_time: string
        }[]
      }
      get_barber_busy_slots_range: {
        Args: { p_barber_id: string; p_from: string; p_to: string }
        Returns: {
          busy_date: string
          duration_minutes: number
          start_time: string
        }[]
      }
      get_barber_dashboard_analytics: { Args: never; Returns: Json }
      get_booking_counterparts: {
        Args: { p_booking_ids: string[] }
        Returns: {
          booking_id: string
          id: string
          name: string
          profile_image: string
        }[]
      }
      get_review_authors: {
        Args: { p_review_ids: string[] }
        Returns: {
          first_name: string
          review_id: string
        }[]
      }
      insert_trip_notification: {
        Args: {
          p_event: string
          p_trip: Database["public"]["Tables"]["booking_trips"]["Row"]
        }
        Returns: undefined
      }
      mark_trip_arrived: {
        Args: { p_booking_id: string }
        Returns: {
          accuracy_m: number | null
          arrived_at: string | null
          arriving_notified_at: string | null
          barber_id: string
          booking_id: string
          customer_id: string
          dest_latitude: number | null
          dest_longitude: number | null
          ended_at: string | null
          eta_at: string | null
          heading: number | null
          latitude: number | null
          longitude: number | null
          position_at: string | null
          remaining_distance_m: number | null
          route_polyline: string | null
          route_source: string | null
          speed_mps: number | null
          started_at: string
          status: Database["public"]["Enums"]["trip_status_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "booking_trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notification_push_copy: {
        Args: {
          p_actor_name: string
          p_event: string
          p_language: string
          p_status: Database["public"]["Enums"]["booking_status_type"]
        }
        Returns: {
          body: string
          title: string
        }[]
      }
      register_push_token: {
        Args: { p_language?: string; p_platform: string; p_token: string }
        Returns: undefined
      }
      start_trip: {
        Args: {
          p_booking_id: string
          p_dest_latitude?: number
          p_dest_longitude?: number
          p_eta_seconds?: number
          p_latitude: number
          p_longitude: number
          p_remaining_distance_m?: number
          p_route_polyline?: string
          p_route_source?: string
        }
        Returns: {
          accuracy_m: number | null
          arrived_at: string | null
          arriving_notified_at: string | null
          barber_id: string
          booking_id: string
          customer_id: string
          dest_latitude: number | null
          dest_longitude: number | null
          ended_at: string | null
          eta_at: string | null
          heading: number | null
          latitude: number | null
          longitude: number | null
          position_at: string | null
          remaining_distance_m: number | null
          route_polyline: string | null
          route_source: string | null
          speed_mps: number | null
          started_at: string
          status: Database["public"]["Enums"]["trip_status_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "booking_trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unregister_push_token: { Args: { p_token: string }; Returns: undefined }
      update_trip_position: {
        Args: {
          p_accuracy_m?: number
          p_booking_id: string
          p_eta_seconds?: number
          p_heading?: number
          p_latitude: number
          p_longitude: number
          p_remaining_distance_m?: number
          p_route_polyline?: string
          p_route_source?: string
          p_speed_mps?: number
        }
        Returns: {
          accuracy_m: number | null
          arrived_at: string | null
          arriving_notified_at: string | null
          barber_id: string
          booking_id: string
          customer_id: string
          dest_latitude: number | null
          dest_longitude: number | null
          ended_at: string | null
          eta_at: string | null
          heading: number | null
          latitude: number | null
          longitude: number | null
          position_at: string | null
          remaining_distance_m: number | null
          route_polyline: string | null
          route_source: string | null
          speed_mps: number | null
          started_at: string
          status: Database["public"]["Enums"]["trip_status_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "booking_trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      booking_status_type:
        | "pending"
        | "accepted"
        | "rejected"
        | "completed"
        | "cancelled"
      trip_status_type: "en_route" | "arrived" | "ended"
      user_role: "customer" | "barber" | "admin"
      verification_status_type: "pending" | "approved" | "rejected"
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
    Enums: {
      booking_status_type: [
        "pending",
        "accepted",
        "rejected",
        "completed",
        "cancelled",
      ],
      trip_status_type: ["en_route", "arrived", "ended"],
      user_role: ["customer", "barber", "admin"],
      verification_status_type: ["pending", "approved", "rejected"],
    },
  },
} as const
