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
      affiliate_clicks: {
        Row: {
          affiliate_code: string
          created_at: string
          id: string
          ip_hash: string | null
          referrer: string | null
          user_agent: string | null
        }
        Insert: {
          affiliate_code: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Update: {
          affiliate_code?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          referrer?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      affiliate_conversions: {
        Row: {
          affiliate_code: string
          commission_rate: number
          commission_value: number
          created_at: string
          id: string
          paid_at: string | null
          payment_id: string | null
          payout_status: string
          plan_name: string | null
          plan_value: number
          status: string
          subscriber_user_id: string
          subscription_id: string | null
        }
        Insert: {
          affiliate_code: string
          commission_rate?: number
          commission_value?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          payout_status?: string
          plan_name?: string | null
          plan_value?: number
          status?: string
          subscriber_user_id: string
          subscription_id?: string | null
        }
        Update: {
          affiliate_code?: string
          commission_rate?: number
          commission_value?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          payout_status?: string
          plan_name?: string | null
          plan_value?: number
          status?: string
          subscriber_user_id?: string
          subscription_id?: string | null
        }
        Relationships: []
      }
      affiliate_settings: {
        Row: {
          commission_rate: number
          id: number
          minimum_payout: number
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          id?: number
          minimum_payout?: number
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          id?: number
          minimum_payout?: number
          updated_at?: string
        }
        Relationships: []
      }
      affiliates: {
        Row: {
          code: string
          commission_rate: number | null
          created_at: string
          id: string
          is_active: boolean
          link: string | null
          ref: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          commission_rate?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          link?: string | null
          ref?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          commission_rate?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          link?: string | null
          ref?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      aliexpress_oauth_states: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          state: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          state: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      aliexpress_sync_log: {
        Row: {
          categories_processed: number
          created_at: string
          duration_ms: number | null
          error_count: number
          error_message: string | null
          finished_at: string | null
          id: string
          products_dropped_from_top: number
          products_new: number
          products_updated: number
          started_at: string
          status: string
          triggered_by: string
        }
        Insert: {
          categories_processed?: number
          created_at?: string
          duration_ms?: number | null
          error_count?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          products_dropped_from_top?: number
          products_new?: number
          products_updated?: number
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Update: {
          categories_processed?: number
          created_at?: string
          duration_ms?: number | null
          error_count?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          products_dropped_from_top?: number
          products_new?: number
          products_updated?: number
          started_at?: string
          status?: string
          triggered_by?: string
        }
        Relationships: []
      }
      atlas_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          product_data: Json | null
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          product_data?: Json | null
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          product_data?: Json | null
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atlas_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "atlas_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      atlas_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      catalog_products: {
        Row: {
          aliexpress_category_id: string | null
          brand: string | null
          category: string | null
          cost_price: number
          created_at: string | null
          description: string | null
          external_id: string
          id: string
          images: Json | null
          in_top_50: boolean
          is_active: boolean | null
          is_blocked: boolean
          margin_percent: number
          ml_category_id: string | null
          ml_category_status: string
          ml_size_grid_id: string | null
          model: string | null
          orders_count: number | null
          original_price: number | null
          product_url: string | null
          rating: number | null
          reviews_count: number | null
          scraped_at: string | null
          source: string
          stock_quantity: number | null
          suggested_price: number
          supplier_contact: string | null
          supplier_name: string | null
          title: string
          updated_at: string | null
          variants: Json | null
          weight: number | null
        }
        Insert: {
          aliexpress_category_id?: string | null
          brand?: string | null
          category?: string | null
          cost_price: number
          created_at?: string | null
          description?: string | null
          external_id: string
          id?: string
          images?: Json | null
          in_top_50?: boolean
          is_active?: boolean | null
          is_blocked?: boolean
          margin_percent: number
          ml_category_id?: string | null
          ml_category_status?: string
          ml_size_grid_id?: string | null
          model?: string | null
          orders_count?: number | null
          original_price?: number | null
          product_url?: string | null
          rating?: number | null
          reviews_count?: number | null
          scraped_at?: string | null
          source?: string
          stock_quantity?: number | null
          suggested_price: number
          supplier_contact?: string | null
          supplier_name?: string | null
          title: string
          updated_at?: string | null
          variants?: Json | null
          weight?: number | null
        }
        Update: {
          aliexpress_category_id?: string | null
          brand?: string | null
          category?: string | null
          cost_price?: number
          created_at?: string | null
          description?: string | null
          external_id?: string
          id?: string
          images?: Json | null
          in_top_50?: boolean
          is_active?: boolean | null
          is_blocked?: boolean
          margin_percent?: number
          ml_category_id?: string | null
          ml_category_status?: string
          ml_size_grid_id?: string | null
          model?: string | null
          orders_count?: number | null
          original_price?: number | null
          product_url?: string | null
          rating?: number | null
          reviews_count?: number | null
          scraped_at?: string | null
          source?: string
          stock_quantity?: number | null
          suggested_price?: number
          supplier_contact?: string | null
          supplier_name?: string | null
          title?: string
          updated_at?: string | null
          variants?: Json | null
          weight?: number | null
        }
        Relationships: []
      }
      category_mapping: {
        Row: {
          active: boolean
          aliexpress_category_id: string
          aliexpress_category_name: string | null
          created_at: string
          id: string
          updated_at: string
          velo_category: string
        }
        Insert: {
          active?: boolean
          aliexpress_category_id: string
          aliexpress_category_name?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          velo_category: string
        }
        Update: {
          active?: boolean
          aliexpress_category_id?: string
          aliexpress_category_name?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          velo_category?: string
        }
        Relationships: []
      }
      cj_token_cache: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: number
          refresh_token: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: number
          refresh_token: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: number
          refresh_token?: string
        }
        Relationships: []
      }
      collection_products: {
        Row: {
          added_at: string
          collection_id: string
          id: string
          product_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          id?: string
          product_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_sales_pages: {
        Row: {
          benefits: Json
          catalog_product_id: string | null
          created_at: string
          cta_text: string
          headline: string
          hero_image_url: string | null
          id: string
          price_brl: number | null
          product_title: string | null
          published: boolean
          published_at: string | null
          slug: string
          store_description: string | null
          store_logo_url: string | null
          store_name: string | null
          subheadline: string | null
          testimonials: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          benefits?: Json
          catalog_product_id?: string | null
          created_at?: string
          cta_text?: string
          headline: string
          hero_image_url?: string | null
          id?: string
          price_brl?: number | null
          product_title?: string | null
          published?: boolean
          published_at?: string | null
          slug: string
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          subheadline?: string | null
          testimonials?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          benefits?: Json
          catalog_product_id?: string | null
          created_at?: string
          cta_text?: string
          headline?: string
          hero_image_url?: string | null
          id?: string
          price_brl?: number | null
          product_title?: string | null
          published?: boolean
          published_at?: string | null
          slug?: string
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          subheadline?: string | null
          testimonials?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_sales_pages_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      help_feed_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_feed_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "help_feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      help_feed_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_feed_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "help_feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      help_feed_posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      help_feed_tutorials: {
        Row: {
          body_md: string
          created_at: string
          id: string
          order_index: number
          title: string
          updated_at: string
        }
        Insert: {
          body_md: string
          created_at?: string
          id?: string
          order_index?: number
          title: string
          updated_at?: string
        }
        Update: {
          body_md?: string
          created_at?: string
          id?: string
          order_index?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_category_prediction_log: {
        Row: {
          created_at: string
          final_category: string | null
          final_status: string | null
          id: string
          low_confidence: boolean
          predicted_normalized: string | null
          predicted_raw: string | null
          product_id: string | null
          requires_size_grid: boolean | null
          source: string | null
          title_normalized: string | null
          title_raw: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          final_category?: string | null
          final_status?: string | null
          id?: string
          low_confidence?: boolean
          predicted_normalized?: string | null
          predicted_raw?: string | null
          product_id?: string | null
          requires_size_grid?: boolean | null
          source?: string | null
          title_normalized?: string | null
          title_raw?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          final_category?: string | null
          final_status?: string | null
          id?: string
          low_confidence?: boolean
          predicted_normalized?: string | null
          predicted_raw?: string | null
          product_id?: string | null
          requires_size_grid?: boolean | null
          source?: string | null
          title_normalized?: string | null
          title_raw?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ml_oauth_states: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          redirect_to: string | null
          state: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          redirect_to?: string | null
          state: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          redirect_to?: string | null
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      ml_republication_log: {
        Row: {
          catalog_product_id: string | null
          created_at: string
          error: string | null
          id: string
          new_ml_item_id: string | null
          old_ml_item_id: string
          publication_id: string | null
          reason: string
          republished_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          catalog_product_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          new_ml_item_id?: string | null
          old_ml_item_id: string
          publication_id?: string | null
          reason?: string
          republished_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          catalog_product_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          new_ml_item_id?: string | null
          old_ml_item_id?: string
          publication_id?: string | null
          reason?: string
          republished_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          buyer_address: string | null
          buyer_city: string | null
          buyer_complement: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_neighborhood: string | null
          buyer_number: string | null
          buyer_phone: string | null
          buyer_state: string | null
          buyer_zip: string | null
          catalog_product_id: string | null
          cj_order_id: string | null
          cj_product_id: string | null
          cj_product_url: string | null
          cj_variant_id: string | null
          cost_price: number | null
          created_at: string | null
          external_order_id: string | null
          fulfilled_at: string | null
          fulfillment_error: string | null
          fulfillment_status: string | null
          id: string
          ml_order_id: string | null
          ml_tracking_sent: boolean | null
          ml_tracking_sent_at: string | null
          ml_user_id: string | null
          ordered_at: string | null
          platform: string
          product_image: string | null
          product_title: string
          profit: number | null
          quantity: number
          raw: Json | null
          sale_price: number
          shipment_id: string | null
          status: string
          supplier_url: string | null
          total_amount: number | null
          tracking_code: string | null
          user_id: string
        }
        Insert: {
          buyer_address?: string | null
          buyer_city?: string | null
          buyer_complement?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_neighborhood?: string | null
          buyer_number?: string | null
          buyer_phone?: string | null
          buyer_state?: string | null
          buyer_zip?: string | null
          catalog_product_id?: string | null
          cj_order_id?: string | null
          cj_product_id?: string | null
          cj_product_url?: string | null
          cj_variant_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          external_order_id?: string | null
          fulfilled_at?: string | null
          fulfillment_error?: string | null
          fulfillment_status?: string | null
          id?: string
          ml_order_id?: string | null
          ml_tracking_sent?: boolean | null
          ml_tracking_sent_at?: string | null
          ml_user_id?: string | null
          ordered_at?: string | null
          platform?: string
          product_image?: string | null
          product_title?: string
          profit?: number | null
          quantity?: number
          raw?: Json | null
          sale_price?: number
          shipment_id?: string | null
          status?: string
          supplier_url?: string | null
          total_amount?: number | null
          tracking_code?: string | null
          user_id: string
        }
        Update: {
          buyer_address?: string | null
          buyer_city?: string | null
          buyer_complement?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_neighborhood?: string | null
          buyer_number?: string | null
          buyer_phone?: string | null
          buyer_state?: string | null
          buyer_zip?: string | null
          catalog_product_id?: string | null
          cj_order_id?: string | null
          cj_product_id?: string | null
          cj_product_url?: string | null
          cj_variant_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          external_order_id?: string | null
          fulfilled_at?: string | null
          fulfillment_error?: string | null
          fulfillment_status?: string | null
          id?: string
          ml_order_id?: string | null
          ml_tracking_sent?: boolean | null
          ml_tracking_sent_at?: string | null
          ml_user_id?: string | null
          ordered_at?: string | null
          platform?: string
          product_image?: string | null
          product_title?: string
          profit?: number | null
          quantity?: number
          raw?: Json | null
          sale_price?: number
          shipment_id?: string | null
          status?: string
          supplier_url?: string | null
          total_amount?: number | null
          tracking_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          aliexpress_access_token: string | null
          aliexpress_refresh_token: string | null
          aliexpress_token_expires_at: string | null
          avatar_url: string | null
          categorias: string[] | null
          created_at: string
          display_name: string | null
          disponibilidade_semanal: string | null
          email: string | null
          experiencia: string | null
          full_store_upsell_status: string | null
          id: string
          is_admin: boolean
          loja_nome: string | null
          nicho: string | null
          objetivo: string | null
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          onboarding_niche: string | null
          plano: string | null
          refund_cooldown_until: string | null
          store_name: string | null
          tutorial_completed: boolean
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          aliexpress_access_token?: string | null
          aliexpress_refresh_token?: string | null
          aliexpress_token_expires_at?: string | null
          avatar_url?: string | null
          categorias?: string[] | null
          created_at?: string
          display_name?: string | null
          disponibilidade_semanal?: string | null
          email?: string | null
          experiencia?: string | null
          full_store_upsell_status?: string | null
          id?: string
          is_admin?: boolean
          loja_nome?: string | null
          nicho?: string | null
          objetivo?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_niche?: string | null
          plano?: string | null
          refund_cooldown_until?: string | null
          store_name?: string | null
          tutorial_completed?: boolean
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          aliexpress_access_token?: string | null
          aliexpress_refresh_token?: string | null
          aliexpress_token_expires_at?: string | null
          avatar_url?: string | null
          categorias?: string[] | null
          created_at?: string
          display_name?: string | null
          disponibilidade_semanal?: string | null
          email?: string | null
          experiencia?: string | null
          full_store_upsell_status?: string | null
          id?: string
          is_admin?: boolean
          loja_nome?: string | null
          nicho?: string | null
          objetivo?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          onboarding_niche?: string | null
          plano?: string | null
          refund_cooldown_until?: string | null
          store_name?: string | null
          tutorial_completed?: boolean
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      project_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string
          project_id: string
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email: string
          project_id: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string
          project_id?: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invite_token: string
          invited_email: string
          invited_rewarded: boolean
          invited_user_id: string | null
          inviter_id: string
          inviter_rewarded: boolean
          linked_at: string | null
          status: string
          subscribed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          invite_token: string
          invited_email: string
          invited_rewarded?: boolean
          invited_user_id?: string | null
          inviter_id: string
          inviter_rewarded?: boolean
          linked_at?: string | null
          status?: string
          subscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_email?: string
          invited_rewarded?: boolean
          invited_user_id?: string | null
          inviter_id?: string
          inviter_rewarded?: boolean
          linked_at?: string | null
          status?: string
          subscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          created_at: string
          id: string
          payment_id: string | null
          processed_at: string | null
          provider_response: Json | null
          reason: string
          reason_details: string | null
          refund_amount: number
          requested_at: string
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_id?: string | null
          processed_at?: string | null
          provider_response?: Json | null
          reason: string
          reason_details?: string | null
          refund_amount?: number
          requested_at?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_id?: string | null
          processed_at?: string | null
          provider_response?: Json | null
          reason?: string
          reason_details?: string | null
          refund_amount?: number
          requested_at?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sales_reports: {
        Row: {
          created_at: string
          id: string
          metrics: Json
          overall_score: number
          scores: Json
          sections: Json
          summary: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metrics?: Json
          overall_score?: number
          scores?: Json
          sections?: Json
          summary?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metrics?: Json
          overall_score?: number
          scores?: Json
          sections?: Json
          summary?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      seller_mp_accounts: {
        Row: {
          access_token: string
          connected_at: string
          created_at: string
          id: string
          mp_user_id: string
          public_key: string | null
          refresh_token: string | null
          seller_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          created_at?: string
          id?: string
          mp_user_id: string
          public_key?: string | null
          refresh_token?: string | null
          seller_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          created_at?: string
          id?: string
          mp_user_id?: string
          public_key?: string | null
          refresh_token?: string | null
          seller_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shopify_connections: {
        Row: {
          access_token: string
          created_at: string
          id: string
          scope: string | null
          shop_domain: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          scope?: string | null
          shop_domain: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          scope?: string | null
          shop_domain?: string
          user_id?: string
        }
        Relationships: []
      }
      shopify_oauth_states: {
        Row: {
          created_at: string
          shop_domain: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          shop_domain: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          shop_domain?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      store_orders: {
        Row: {
          buyer_cpf: string | null
          buyer_email: string
          buyer_name: string
          buyer_phone: string | null
          catalog_product_id: string | null
          created_at: string
          id: string
          mp_external_reference: string | null
          mp_payment_id: string | null
          payment_method: string
          payment_status: string
          pix_qr_code: string | null
          pix_qr_code_base64: string | null
          product_image_url: string | null
          product_title: string
          project_id: string | null
          quantity: number
          sales_page_id: string | null
          shipping_address: Json | null
          total: number
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer_cpf?: string | null
          buyer_email: string
          buyer_name: string
          buyer_phone?: string | null
          catalog_product_id?: string | null
          created_at?: string
          id?: string
          mp_external_reference?: string | null
          mp_payment_id?: string | null
          payment_method: string
          payment_status?: string
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          product_image_url?: string | null
          product_title: string
          project_id?: string | null
          quantity?: number
          sales_page_id?: string | null
          shipping_address?: Json | null
          total: number
          unit_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          buyer_cpf?: string | null
          buyer_email?: string
          buyer_name?: string
          buyer_phone?: string | null
          catalog_product_id?: string | null
          created_at?: string
          id?: string
          mp_external_reference?: string | null
          mp_payment_id?: string | null
          payment_method?: string
          payment_status?: string
          pix_qr_code?: string | null
          pix_qr_code_base64?: string | null
          product_image_url?: string | null
          product_title?: string
          project_id?: string | null
          quantity?: number
          sales_page_id?: string | null
          shipping_address?: Json | null
          total?: number
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_orders_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_orders_sales_page_id_fkey"
            columns: ["sales_page_id"]
            isOneToOne: false
            referencedRelation: "generated_sales_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          charge_attempts: number
          confirmation_email_sent_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          discount_percent: number | null
          id: string
          is_trial: boolean
          last_charge_attempt_at: string | null
          last_dunning_email_at: string | null
          mp_card_id: string | null
          mp_customer_id: string | null
          mp_payment_id: string | null
          mp_subscription_id: string | null
          next_charge_amount: number | null
          next_charge_at: string | null
          original_amount: number | null
          payment_method: string | null
          plan: string
          post_trial_plan: string | null
          referral_id: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          charge_attempts?: number
          confirmation_email_sent_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          discount_percent?: number | null
          id?: string
          is_trial?: boolean
          last_charge_attempt_at?: string | null
          last_dunning_email_at?: string | null
          mp_card_id?: string | null
          mp_customer_id?: string | null
          mp_payment_id?: string | null
          mp_subscription_id?: string | null
          next_charge_amount?: number | null
          next_charge_at?: string | null
          original_amount?: number | null
          payment_method?: string | null
          plan?: string
          post_trial_plan?: string | null
          referral_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          charge_attempts?: number
          confirmation_email_sent_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          discount_percent?: number | null
          id?: string
          is_trial?: boolean
          last_charge_attempt_at?: string | null
          last_dunning_email_at?: string | null
          mp_card_id?: string | null
          mp_customer_id?: string | null
          mp_payment_id?: string | null
          mp_subscription_id?: string | null
          next_charge_amount?: number | null
          next_charge_at?: string | null
          original_amount?: number | null
          payment_method?: string | null
          plan?: string
          post_trial_plan?: string | null
          referral_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          cost_price: number
          created_at: string
          external_id: string
          id: string
          product_id: string
          rating: number | null
          raw_data: Json | null
          shipping_cost: number
          shipping_days: number
          stock_status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          external_id: string
          id?: string
          product_id: string
          rating?: number | null
          raw_data?: Json | null
          shipping_cost?: number
          shipping_days?: number
          stock_status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          external_id?: string
          id?: string
          product_id?: string
          rating?: number | null
          raw_data?: Json | null
          shipping_cost?: number
          shipping_days?: number
          stock_status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          api_config: Json | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          api_config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          api_config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          sender: string
          ticket_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          sender: string
          ticket_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          sender?: string
          ticket_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_last_seen_at: string | null
          ai_active: boolean | null
          category: string
          created_at: string | null
          id: string
          status: string | null
          subject: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_last_seen_at?: string | null
          ai_active?: boolean | null
          category?: string
          created_at?: string | null
          id?: string
          status?: string | null
          subject?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_last_seen_at?: string | null
          ai_active?: boolean | null
          category?: string
          created_at?: string | null
          id?: string
          status?: string | null
          subject?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trending_products_history: {
        Row: {
          created_at: string
          id: string
          margin_percent: number | null
          sell_price_brl: number | null
          snapshot_date: string
          sold_quantity_total: number | null
          trending_product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          margin_percent?: number | null
          sell_price_brl?: number | null
          snapshot_date?: string
          sold_quantity_total?: number | null
          trending_product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          margin_percent?: number | null
          sell_price_brl?: number | null
          snapshot_date?: string
          sold_quantity_total?: number | null
          trending_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trending_products_history_trending_product_id_fkey"
            columns: ["trending_product_id"]
            isOneToOne: false
            referencedRelation: "trending_products_real"
            referencedColumns: ["id"]
          },
        ]
      }
      trending_products_real: {
        Row: {
          ali_cost_usd: number | null
          ali_product_id: string | null
          ali_url: string | null
          brand: string | null
          category: string | null
          collected_at: string
          cost_price_brl: number | null
          created_at: string
          id: string
          image: string | null
          images: Json
          margin_percent: number | null
          markup: number | null
          match_confidence: string | null
          ml_item_id: string
          ml_permalink: string | null
          rating: number | null
          sell_price_brl: number | null
          sold_quantity_month_estimate: number | null
          sold_quantity_total: number | null
          title: string
          updated_at: string
        }
        Insert: {
          ali_cost_usd?: number | null
          ali_product_id?: string | null
          ali_url?: string | null
          brand?: string | null
          category?: string | null
          collected_at?: string
          cost_price_brl?: number | null
          created_at?: string
          id?: string
          image?: string | null
          images?: Json
          margin_percent?: number | null
          markup?: number | null
          match_confidence?: string | null
          ml_item_id: string
          ml_permalink?: string | null
          rating?: number | null
          sell_price_brl?: number | null
          sold_quantity_month_estimate?: number | null
          sold_quantity_total?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          ali_cost_usd?: number | null
          ali_product_id?: string | null
          ali_url?: string | null
          brand?: string | null
          category?: string | null
          collected_at?: string
          cost_price_brl?: number | null
          created_at?: string
          id?: string
          image?: string | null
          images?: Json
          margin_percent?: number | null
          markup?: number | null
          match_confidence?: string | null
          ml_item_id?: string
          ml_permalink?: string | null
          rating?: number | null
          sell_price_brl?: number | null
          sold_quantity_month_estimate?: number | null
          sold_quantity_total?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      trending_products_staging: {
        Row: {
          ali_cost_usd: number | null
          ali_product_id: string | null
          ali_url: string | null
          brand: string | null
          category: string | null
          collected_at: string
          cost_price_brl: number | null
          created_at: string
          id: string
          image: string | null
          images: Json
          margin_percent: number | null
          markup: number | null
          match_confidence: string | null
          ml_item_id: string
          ml_permalink: string | null
          rating: number | null
          reason: string | null
          sell_price_brl: number | null
          similarity_score: number | null
          sold_quantity_total: number | null
          title: string
        }
        Insert: {
          ali_cost_usd?: number | null
          ali_product_id?: string | null
          ali_url?: string | null
          brand?: string | null
          category?: string | null
          collected_at?: string
          cost_price_brl?: number | null
          created_at?: string
          id?: string
          image?: string | null
          images?: Json
          margin_percent?: number | null
          markup?: number | null
          match_confidence?: string | null
          ml_item_id: string
          ml_permalink?: string | null
          rating?: number | null
          reason?: string | null
          sell_price_brl?: number | null
          similarity_score?: number | null
          sold_quantity_total?: number | null
          title: string
        }
        Update: {
          ali_cost_usd?: number | null
          ali_product_id?: string | null
          ali_url?: string | null
          brand?: string | null
          category?: string | null
          collected_at?: string
          cost_price_brl?: number | null
          created_at?: string
          id?: string
          image?: string | null
          images?: Json
          margin_percent?: number | null
          markup?: number | null
          match_confidence?: string | null
          ml_item_id?: string
          ml_permalink?: string | null
          rating?: number | null
          reason?: string | null
          sell_price_brl?: number | null
          similarity_score?: number | null
          sold_quantity_total?: number | null
          title?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          access_token: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          ml_user_id: number | null
          platform: string
          refresh_token: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ml_user_id?: number | null
          platform: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ml_user_id?: number | null
          platform?: string
          refresh_token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_page_views: {
        Row: {
          id: string
          path: string
          product_id: string | null
          product_title: string | null
          title: string | null
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          path: string
          product_id?: string | null
          product_title?: string | null
          title?: string | null
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          path?: string
          product_id?: string | null
          product_title?: string | null
          title?: string | null
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      user_projects: {
        Row: {
          created_at: string
          id: string
          last_edited_at: string
          metadata: Json
          nome: string
          preview_storage_path: string | null
          preview_url: string | null
          published_at: string | null
          source_id: string | null
          source_kind: string | null
          status: string
          tipo_projeto: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_edited_at?: string
          metadata?: Json
          nome?: string
          preview_storage_path?: string | null
          preview_url?: string | null
          published_at?: string | null
          source_id?: string | null
          source_kind?: string | null
          status?: string
          tipo_projeto: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_edited_at?: string
          metadata?: Json
          nome?: string
          preview_storage_path?: string | null
          preview_url?: string | null
          published_at?: string | null
          source_id?: string | null
          source_kind?: string | null
          status?: string
          tipo_projeto?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_publications: {
        Row: {
          catalog_product_id: string | null
          cj_product_id: string | null
          cj_product_url: string | null
          cj_variant_id: string | null
          cost_price: number | null
          created_at: string | null
          id: string
          ml_closed_at: string | null
          ml_item_id: string
          permalink: string | null
          price: number | null
          published_at: string | null
          status: string | null
          thumbnail: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          catalog_product_id?: string | null
          cj_product_id?: string | null
          cj_product_url?: string | null
          cj_variant_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          id?: string
          ml_closed_at?: string | null
          ml_item_id: string
          permalink?: string | null
          price?: number | null
          published_at?: string | null
          status?: string | null
          thumbnail?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          catalog_product_id?: string | null
          cj_product_id?: string | null
          cj_product_url?: string | null
          cj_variant_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          id?: string
          ml_closed_at?: string | null
          ml_item_id?: string
          permalink?: string | null
          price?: number | null
          published_at?: string | null
          status?: string | null
          thumbnail?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          started_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      ml_orders_view: {
        Row: {
          buyer_address: string | null
          buyer_city: string | null
          buyer_complement: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_neighborhood: string | null
          buyer_number: string | null
          buyer_phone: string | null
          buyer_state: string | null
          buyer_zip: string | null
          catalog_images: Json | null
          catalog_product_id: string | null
          catalog_title: string | null
          cost_price: number | null
          created_at: string | null
          external_order_id: string | null
          fulfillment_status: string | null
          id: string | null
          ml_order_id: string | null
          ml_user_id: string | null
          ordered_at: string | null
          product_image: string | null
          product_title: string | null
          profit: number | null
          quantity: number | null
          sale_price: number | null
          shipment_id: string | null
          status: string | null
          supplier_name: string | null
          supplier_url: string | null
          total_amount: number | null
          tracking_code: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ml_category_predictions_last_30d: {
        Row: {
          day: string | null
          final_status: string | null
          requires_size_grid: boolean | null
          total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_project_invites: { Args: never; Returns: number }
      get_customer_orders: {
        Args: { p_email: string; p_slug: string }
        Returns: {
          created_at: string
          id: string
          payment_method: string
          payment_status: string
          product_image_url: string
          product_title: string
          quantity: number
          total: number
          unit_price: number
        }[]
      }
      get_help_feed_authors: {
        Args: { _author_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
        }[]
      }
      get_public_project: {
        Args: { p_slug: string }
        Returns: {
          created_at: string
          id: string
          last_edited_at: string
          metadata: Json
          nome: string
          preview_storage_path: string | null
          preview_url: string | null
          published_at: string | null
          source_id: string | null
          source_kind: string | null
          status: string
          tipo_projeto: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_public_store_products: {
        Args: { p_ids: string[] }
        Returns: {
          brand: string
          category: string
          description: string
          id: string
          images: Json
          model: string
          original_price: number
          rating: number
          reviews_count: number
          suggested_price: number
          title: string
          variants: Json
        }[]
      }
      get_trending_product_history: {
        Args: { days?: number; product_id: string }
        Returns: {
          margin_percent: number
          sell_price_brl: number
          snapshot_date: string
          sold_quantity_total: number
        }[]
      }
      get_trending_products: {
        Args: {
          niche?: string
          page?: number
          page_size?: number
          period?: string
          sort_by?: string
        }
        Returns: {
          brand: string
          category: string
          cost_price: number
          demand_score: number
          ease_score: number
          id: string
          image: string
          images: Json
          margin_percent: number
          margin_score: number
          orders_count: number
          original_price: number
          rating: number
          score: number
          scraped_at: string
          stock_quantity: number
          suggested_price: number
          title: string
          total_count: number
          viral_score: number
        }[]
      }
      get_user_projects: {
        Args: never
        Returns: {
          created_at: string
          id: string
          last_edited_at: string
          metadata: Json
          nome: string
          preview_storage_path: string | null
          preview_url: string | null
          published_at: string | null
          source_id: string | null
          source_kind: string | null
          status: string
          tipo_projeto: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "user_projects"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      invite_project_member: {
        Args: { p_email: string; p_project: string; p_role?: string }
        Returns: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string
          project_id: string
          role: string
          status: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "project_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_active_project_editor: {
        Args: { p_project: string; p_user: string }
        Returns: boolean
      }
      is_active_project_member: {
        Args: { p_project: string; p_user: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_project_owner: {
        Args: { p_project: string; p_user: string }
        Returns: boolean
      }
      user_has_active_paid_plan: {
        Args: { target_user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "influencer"
      ml_category_status: "pending" | "auto" | "needs_manual" | "manual"
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
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "influencer"],
      ml_category_status: ["pending", "auto", "needs_manual", "manual"],
    },
  },
} as const
