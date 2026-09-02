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
      affiliate_applications: {
        Row: {
          affiliate_code: string | null
          agreed_terms: boolean
          audience_range: string | null
          content_niche: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          pix_keys: Json
          promotion_plan: string | null
          socials: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_code?: string | null
          agreed_terms?: boolean
          audience_range?: string | null
          content_niche?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          pix_keys?: Json
          promotion_plan?: string | null
          socials?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_code?: string | null
          agreed_terms?: boolean
          audience_range?: string | null
          content_niche?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          pix_keys?: Json
          promotion_plan?: string | null
          socials?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      affiliate_clicks: {
        Row: {
          affiliate_code: string
          converted_at: string | null
          created_at: string
          id: string
          ip_hash: string | null
          reached_payment_at: string | null
          referrer: string | null
          signup_at: string | null
          signup_user_id: string | null
          user_agent: string | null
          visitor_id: string | null
        }
        Insert: {
          affiliate_code: string
          converted_at?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          reached_payment_at?: string | null
          referrer?: string | null
          signup_at?: string | null
          signup_user_id?: string | null
          user_agent?: string | null
          visitor_id?: string | null
        }
        Update: {
          affiliate_code?: string
          converted_at?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          reached_payment_at?: string | null
          referrer?: string | null
          signup_at?: string | null
          signup_user_id?: string | null
          user_agent?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      affiliate_conversions: {
        Row: {
          affiliate_code: string
          commission_rate: number
          commission_value: number
          created_at: string
          cycle_number: number
          cycle_type: string
          debt_settled_at: string | null
          id: string
          paid_at: string | null
          payment_id: string | null
          payout_status: string
          plan_name: string | null
          plan_value: number
          provider_subscription_id: string | null
          reference_month: string
          refunded_at: string | null
          status: string
          subscriber_user_id: string
          subscription_id: string | null
        }
        Insert: {
          affiliate_code: string
          commission_rate?: number
          commission_value?: number
          created_at?: string
          cycle_number?: number
          cycle_type?: string
          debt_settled_at?: string | null
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          payout_status?: string
          plan_name?: string | null
          plan_value?: number
          provider_subscription_id?: string | null
          reference_month?: string
          refunded_at?: string | null
          status?: string
          subscriber_user_id: string
          subscription_id?: string | null
        }
        Update: {
          affiliate_code?: string
          commission_rate?: number
          commission_value?: number
          created_at?: string
          cycle_number?: number
          cycle_type?: string
          debt_settled_at?: string | null
          id?: string
          paid_at?: string | null
          payment_id?: string | null
          payout_status?: string
          plan_name?: string | null
          plan_value?: number
          provider_subscription_id?: string | null
          reference_month?: string
          refunded_at?: string | null
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
      affiliate_withdrawal_items: {
        Row: {
          amount: number
          conversion_id: string
          created_at: string
          id: string
          is_live: boolean
          withdrawal_id: string
        }
        Insert: {
          amount?: number
          conversion_id: string
          created_at?: string
          id?: string
          is_live?: boolean
          withdrawal_id: string
        }
        Update: {
          amount?: number
          conversion_id?: string
          created_at?: string
          id?: string
          is_live?: boolean
          withdrawal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_withdrawal_items_conversion_id_fkey"
            columns: ["conversion_id"]
            isOneToOne: false
            referencedRelation: "affiliate_conversions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_withdrawal_items_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "affiliate_withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_withdrawal_requests: {
        Row: {
          admin_note: string | null
          affiliate_code: string
          amount: number
          cancelled_at: string | null
          created_at: string
          decided_at: string | null
          id: string
          paid_at: string | null
          pix_key: string | null
          pix_key_type: string | null
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          affiliate_code: string
          amount: number
          cancelled_at?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          affiliate_code?: string
          amount?: number
          cancelled_at?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          paid_at?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id?: string
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
          removed_at: string | null
          removed_by: string | null
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
          removed_at?: string | null
          removed_by?: string | null
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
          removed_at?: string | null
          removed_by?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_characters: {
        Row: {
          attributes: Json
          created_at: string
          id: string
          image_url: string | null
          mode: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attributes?: Json
          created_at?: string
          id?: string
          image_url?: string | null
          mode?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attributes?: Json
          created_at?: string
          id?: string
          image_url?: string | null
          mode?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_image_generations: {
        Row: {
          created_at: string
          id: string
          mode: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_product_pages: {
        Row: {
          catalog_product_id: string | null
          completed_at: string | null
          content: Json
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          image_count: number | null
          images: Json
          language: string
          provider: string
          provider_page_id: string | null
          source_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          catalog_product_id?: string | null
          completed_at?: string | null
          content?: Json
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          image_count?: number | null
          images?: Json
          language?: string
          provider?: string
          provider_page_id?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          catalog_product_id?: string | null
          completed_at?: string | null
          content?: Json
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          image_count?: number | null
          images?: Json
          language?: string
          provider?: string
          provider_page_id?: string | null
          source_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_product_pages_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
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
      atlas_usage_logs: {
        Row: {
          completion_tokens: number
          created_at: string
          duracao_ms: number | null
          erro: string | null
          etapa: string | null
          id: string
          message_chars: number
          model: string | null
          modelo: string | null
          origem: string
          prompt_tokens: number
          step: number | null
          tokens_cache: number | null
          tokens_entrada: number | null
          tokens_saida: number | null
          tokens_total: number | null
          user_id: string | null
        }
        Insert: {
          completion_tokens?: number
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          etapa?: string | null
          id?: string
          message_chars?: number
          model?: string | null
          modelo?: string | null
          origem: string
          prompt_tokens?: number
          step?: number | null
          tokens_cache?: number | null
          tokens_entrada?: number | null
          tokens_saida?: number | null
          tokens_total?: number | null
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          etapa?: string | null
          id?: string
          message_chars?: number
          model?: string | null
          modelo?: string | null
          origem?: string
          prompt_tokens?: number
          step?: number | null
          tokens_cache?: number | null
          tokens_entrada?: number | null
          tokens_saida?: number | null
          tokens_total?: number | null
          user_id?: string | null
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
      dropship_order_events: {
        Row: {
          actor: string
          created_at: string
          event_type: string
          id: string
          message: string | null
          metadata: Json
          new_status: string | null
          order_id: string
          previous_status: string | null
        }
        Insert: {
          actor?: string
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json
          new_status?: string | null
          order_id: string
          previous_status?: string | null
        }
        Update: {
          actor?: string
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json
          new_status?: string | null
          order_id?: string
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dropship_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "dropship_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      dropship_orders: {
        Row: {
          c7drop_product_url: string | null
          carrier: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          etiqueta_ml_path: string | null
          etiqueta_ml_url: string | null
          id: string
          items: Json
          metadata: Json
          ml_order_id: string | null
          needs_manual_sku: boolean
          needs_shipping_label: boolean
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_reference: string | null
          payment_status: string
          preco_ml: number
          quantidade: number
          seller_email: string | null
          shipping_address: Json | null
          sku_c7drop: string | null
          source: string
          status: string
          total_amount: number
          tracking_code: string | null
          tracking_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          c7drop_product_url?: string | null
          carrier?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          etiqueta_ml_path?: string | null
          etiqueta_ml_url?: string | null
          id?: string
          items?: Json
          metadata?: Json
          ml_order_id?: string | null
          needs_manual_sku?: boolean
          needs_shipping_label?: boolean
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          preco_ml?: number
          quantidade?: number
          seller_email?: string | null
          shipping_address?: Json | null
          sku_c7drop?: string | null
          source?: string
          status?: string
          total_amount?: number
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          c7drop_product_url?: string | null
          carrier?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          etiqueta_ml_path?: string | null
          etiqueta_ml_url?: string | null
          id?: string
          items?: Json
          metadata?: Json
          ml_order_id?: string | null
          needs_manual_sku?: boolean
          needs_shipping_label?: boolean
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          preco_ml?: number
          quantidade?: number
          seller_email?: string | null
          shipping_address?: Json | null
          sku_c7drop?: string | null
          source?: string
          status?: string
          total_amount?: number
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      feature_suggestions: {
        Row: {
          category: string
          comments_count: number
          created_at: string
          description: string
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
          votes_count: number
        }
        Insert: {
          category?: string
          comments_count?: number
          created_at?: string
          description: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
          votes_count?: number
        }
        Update: {
          category?: string
          comments_count?: number
          created_at?: string
          description?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          votes_count?: number
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
      ml_api_cache: {
        Row: {
          body: string
          cache_key: string
          expires_at: string
          updated_at: string
        }
        Insert: {
          body: string
          cache_key: string
          expires_at: string
          updated_at?: string
        }
        Update: {
          body?: string
          cache_key?: string
          expires_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ml_api_circuit: {
        Row: {
          failure_count: number
          id: string
          last_status: number | null
          last_url: string | null
          open_until: string | null
          updated_at: string
          window_started_at: string | null
        }
        Insert: {
          failure_count?: number
          id: string
          last_status?: number | null
          last_url?: string | null
          open_until?: string | null
          updated_at?: string
          window_started_at?: string | null
        }
        Update: {
          failure_count?: number
          id?: string
          last_status?: number | null
          last_url?: string | null
          open_until?: string | null
          updated_at?: string
          window_started_at?: string | null
        }
        Relationships: []
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
      ml_compliance_fixes: {
        Row: {
          after_value: string | null
          attempts: number
          batch: string
          before_value: string | null
          created_at: string
          error_message: string | null
          id: string
          kind: string
          ml_item_id: string
          ml_seller_id: number | null
          ml_status: string | null
          ml_status_before: string | null
          processed_at: string | null
          publication_id: string | null
          scheduled_at: string
          seller_id: string | null
          status: string
          under_review: boolean
          updated_at: string
        }
        Insert: {
          after_value?: string | null
          attempts?: number
          batch?: string
          before_value?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          kind: string
          ml_item_id: string
          ml_seller_id?: number | null
          ml_status?: string | null
          ml_status_before?: string | null
          processed_at?: string | null
          publication_id?: string | null
          scheduled_at?: string
          seller_id?: string | null
          status?: string
          under_review?: boolean
          updated_at?: string
        }
        Update: {
          after_value?: string | null
          attempts?: number
          batch?: string
          before_value?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          kind?: string
          ml_item_id?: string
          ml_seller_id?: number | null
          ml_status?: string | null
          ml_status_before?: string | null
          processed_at?: string | null
          publication_id?: string | null
          scheduled_at?: string
          seller_id?: string | null
          status?: string
          under_review?: boolean
          updated_at?: string
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
      ml_publish_errors: {
        Row: {
          category_id: string | null
          cause: Json | null
          created_at: string
          http_status: number | null
          id: string
          mapped_code: string | null
          mapped_message: string | null
          ml_user_id: number | null
          product_title: string | null
          raw_response: Json | null
          user_id: string | null
        }
        Insert: {
          category_id?: string | null
          cause?: Json | null
          created_at?: string
          http_status?: number | null
          id?: string
          mapped_code?: string | null
          mapped_message?: string | null
          ml_user_id?: number | null
          product_title?: string | null
          raw_response?: Json | null
          user_id?: string | null
        }
        Update: {
          category_id?: string | null
          cause?: Json | null
          created_at?: string
          http_status?: number | null
          id?: string
          mapped_code?: string | null
          mapped_message?: string | null
          ml_user_id?: number | null
          product_title?: string | null
          raw_response?: Json | null
          user_id?: string | null
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
      ml_webhook_queue: {
        Row: {
          application_id: string | null
          attempts: number
          id: string
          last_error: string | null
          ml_user_id: string | null
          payload_raw: Json
          processed_at: string | null
          received_at: string
          resource: string | null
          source: string
          status: string
          topic: string
        }
        Insert: {
          application_id?: string | null
          attempts?: number
          id?: string
          last_error?: string | null
          ml_user_id?: string | null
          payload_raw: Json
          processed_at?: string | null
          received_at?: string
          resource?: string | null
          source?: string
          status?: string
          topic: string
        }
        Update: {
          application_id?: string | null
          attempts?: number
          id?: string
          last_error?: string | null
          ml_user_id?: string | null
          payload_raw?: Json
          processed_at?: string | null
          received_at?: string
          resource?: string | null
          source?: string
          status?: string
          topic?: string
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
          bot_notified_at: string | null
          bot_payload: Json | null
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
          needs_manual_sku: boolean
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
          bot_notified_at?: string | null
          bot_payload?: Json | null
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
          needs_manual_sku?: boolean
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
          bot_notified_at?: string | null
          bot_payload?: Json | null
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
          needs_manual_sku?: boolean
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
      payment_incidents: {
        Row: {
          amount: number | null
          charge_id: string | null
          created_at: string
          details: Json
          id: string
          kind: string
          message: string | null
          related_subscription_id: string | null
          resolved: boolean
          severity: string
          subscription_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          charge_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          kind: string
          message?: string | null
          related_subscription_id?: string | null
          resolved?: boolean
          severity?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          charge_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          kind?: string
          message?: string | null
          related_subscription_id?: string | null
          resolved?: boolean
          severity?: string
          subscription_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
          pix_key: string | null
          pix_key_type: string | null
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
          pix_key?: string | null
          pix_key_type?: string | null
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
          pix_key?: string | null
          pix_key_type?: string | null
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
      referral_rewards: {
        Row: {
          applied_at: string | null
          applied_subscription_id: string | null
          created_at: string
          id: string
          invited_user_id: string | null
          inviter_id: string
          months: number
          new_period_end: string | null
          payment_ref: string
          previous_period_end: string | null
          referral_id: string
          status: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          applied_subscription_id?: string | null
          created_at?: string
          id?: string
          invited_user_id?: string | null
          inviter_id: string
          months?: number
          new_period_end?: string | null
          payment_ref: string
          previous_period_end?: string | null
          referral_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          applied_subscription_id?: string | null
          created_at?: string
          id?: string
          invited_user_id?: string | null
          inviter_id?: string
          months?: number
          new_period_end?: string | null
          payment_ref?: string
          previous_period_end?: string | null
          referral_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
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
          automated: boolean
          charge_id: string | null
          created_at: string
          id: string
          keep_access: boolean
          payment_id: string | null
          processed_at: string | null
          provider_response: Json | null
          reason: string
          reason_details: string | null
          refund_amount: number
          refund_kind: string
          requested_at: string
          status: string
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          automated?: boolean
          charge_id?: string | null
          created_at?: string
          id?: string
          keep_access?: boolean
          payment_id?: string | null
          processed_at?: string | null
          provider_response?: Json | null
          reason: string
          reason_details?: string | null
          refund_amount?: number
          refund_kind?: string
          requested_at?: string
          status?: string
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          automated?: boolean
          charge_id?: string | null
          created_at?: string
          id?: string
          keep_access?: boolean
          payment_id?: string | null
          processed_at?: string | null
          provider_response?: Json | null
          reason?: string
          reason_details?: string | null
          refund_amount?: number
          refund_kind?: string
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
          variant_cost_price: number | null
          variant_label: string | null
          variant_sku: string | null
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
          variant_cost_price?: number | null
          variant_label?: string | null
          variant_sku?: string | null
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
          variant_cost_price?: number | null
          variant_label?: string | null
          variant_sku?: string | null
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
      store_reviews: {
        Row: {
          author_name: string
          comment: string
          created_at: string
          id: string
          product_id: string | null
          project_id: string
          rating: number
        }
        Insert: {
          author_name: string
          comment: string
          created_at?: string
          id?: string
          product_id?: string | null
          project_id: string
          rating: number
        }
        Update: {
          author_name?: string
          comment?: string
          created_at?: string
          id?: string
          product_id?: string | null
          project_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_migrations: {
        Row: {
          amount: number
          created_at: string
          current_period_end: string | null
          id: string
          notes: string | null
          origin_paid_at: string | null
          origin_payment_id: string | null
          origin_provider: string
          origin_subscription_id: string | null
          plan: string
          refundable: boolean
          refundable_until: string | null
          status: string
          subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          current_period_end?: string | null
          id?: string
          notes?: string | null
          origin_paid_at?: string | null
          origin_payment_id?: string | null
          origin_provider: string
          origin_subscription_id?: string | null
          plan: string
          refundable?: boolean
          refundable_until?: string | null
          status: string
          subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          current_period_end?: string | null
          id?: string
          notes?: string | null
          origin_paid_at?: string | null
          origin_payment_id?: string | null
          origin_provider?: string
          origin_subscription_id?: string | null
          plan?: string
          refundable?: boolean
          refundable_until?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_migrations_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: true
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          cancel_at_period_end: boolean
          cancellation_reason: string | null
          cancelled_at: string | null
          charge_attempts: number
          confirmation_email_sent_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          discount_percent: number | null
          duplicate_detected_at: string | null
          duplicate_of_subscription_id: string | null
          duplicate_status: string
          id: string
          is_trial: boolean
          last_charge_attempt_at: string | null
          last_dunning_email_at: string | null
          migrated_to_validapay_at: string | null
          mp_card_id: string | null
          mp_customer_id: string | null
          mp_payment_id: string | null
          mp_subscription_id: string | null
          next_charge_amount: number | null
          next_charge_at: string | null
          origin_paid_at: string | null
          origin_payment_id: string | null
          origin_provider: string | null
          original_amount: number | null
          payment_method: string | null
          plan: string
          post_trial_plan: string | null
          provider: string
          referral_id: string | null
          refundable_until: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
          validapay_charge_id: string | null
          validapay_customer_id: string | null
          validapay_subscription_id: string | null
        }
        Insert: {
          amount?: number
          cancel_at_period_end?: boolean
          cancellation_reason?: string | null
          cancelled_at?: string | null
          charge_attempts?: number
          confirmation_email_sent_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          discount_percent?: number | null
          duplicate_detected_at?: string | null
          duplicate_of_subscription_id?: string | null
          duplicate_status?: string
          id?: string
          is_trial?: boolean
          last_charge_attempt_at?: string | null
          last_dunning_email_at?: string | null
          migrated_to_validapay_at?: string | null
          mp_card_id?: string | null
          mp_customer_id?: string | null
          mp_payment_id?: string | null
          mp_subscription_id?: string | null
          next_charge_amount?: number | null
          next_charge_at?: string | null
          origin_paid_at?: string | null
          origin_payment_id?: string | null
          origin_provider?: string | null
          original_amount?: number | null
          payment_method?: string | null
          plan?: string
          post_trial_plan?: string | null
          provider?: string
          referral_id?: string | null
          refundable_until?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
          validapay_charge_id?: string | null
          validapay_customer_id?: string | null
          validapay_subscription_id?: string | null
        }
        Update: {
          amount?: number
          cancel_at_period_end?: boolean
          cancellation_reason?: string | null
          cancelled_at?: string | null
          charge_attempts?: number
          confirmation_email_sent_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          discount_percent?: number | null
          duplicate_detected_at?: string | null
          duplicate_of_subscription_id?: string | null
          duplicate_status?: string
          id?: string
          is_trial?: boolean
          last_charge_attempt_at?: string | null
          last_dunning_email_at?: string | null
          migrated_to_validapay_at?: string | null
          mp_card_id?: string | null
          mp_customer_id?: string | null
          mp_payment_id?: string | null
          mp_subscription_id?: string | null
          next_charge_amount?: number | null
          next_charge_at?: string | null
          origin_paid_at?: string | null
          origin_payment_id?: string | null
          origin_provider?: string | null
          original_amount?: number | null
          payment_method?: string | null
          plan?: string
          post_trial_plan?: string | null
          provider?: string
          referral_id?: string | null
          refundable_until?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
          validapay_charge_id?: string | null
          validapay_customer_id?: string | null
          validapay_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_duplicate_of_subscription_id_fkey"
            columns: ["duplicate_of_subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
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
          attachment_type: string | null
          attachment_url: string | null
          created_at: string | null
          edited_at: string | null
          id: string
          message: string
          sender: string
          ticket_id: string
          user_id: string | null
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string | null
          edited_at?: string | null
          id?: string
          message: string
          sender: string
          ticket_id: string
          user_id?: string | null
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string | null
          edited_at?: string | null
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
      tiktok_shop_accounts: {
        Row: {
          access_token: string
          connected_at: string
          created_at: string
          currency: string | null
          id: string
          refresh_token: string | null
          region: string | null
          shop_cipher: string | null
          shop_id: string | null
          shop_name: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          created_at?: string
          currency?: string | null
          id?: string
          refresh_token?: string | null
          region?: string | null
          shop_cipher?: string | null
          shop_id?: string | null
          shop_name?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          created_at?: string
          currency?: string | null
          id?: string
          refresh_token?: string | null
          region?: string | null
          shop_cipher?: string | null
          shop_id?: string | null
          shop_name?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tiktok_shop_oauth_states: {
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
          expires_at: string
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
      tiktok_shop_publications: {
        Row: {
          catalog_product_id: string
          created_at: string
          error_message: string | null
          id: string
          published_at: string | null
          shop_id: string | null
          status: string
          tiktok_product_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          catalog_product_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          published_at?: string | null
          shop_id?: string | null
          status?: string
          tiktok_product_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          catalog_product_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          published_at?: string | null
          shop_id?: string | null
          status?: string
          tiktok_product_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_shop_publications_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_products"
            referencedColumns: ["id"]
          },
        ]
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
      user_products: {
        Row: {
          brand: string | null
          category: string | null
          cost_price: number | null
          created_at: string
          description: string
          height_cm: number | null
          id: string
          images: Json
          length_cm: number | null
          model: string | null
          price: number
          sku: string | null
          status: string
          stock_quantity: number
          title: string
          updated_at: string
          user_id: string
          weight: number | null
          width_cm: number | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string
          height_cm?: number | null
          id?: string
          images?: Json
          length_cm?: number | null
          model?: string | null
          price?: number
          sku?: string | null
          status?: string
          stock_quantity?: number
          title: string
          updated_at?: string
          user_id: string
          weight?: number | null
          width_cm?: number | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string
          height_cm?: number | null
          id?: string
          images?: Json
          length_cm?: number | null
          model?: string | null
          price?: number
          sku?: string | null
          status?: string
          stock_quantity?: number
          title?: string
          updated_at?: string
          user_id?: string
          weight?: number | null
          width_cm?: number | null
        }
        Relationships: []
      }
      user_projects: {
        Row: {
          created_at: string
          id: string
          last_edited_at: string
          meta_pixel_id: string | null
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
          meta_pixel_id?: string | null
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
          meta_pixel_id?: string | null
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
          family_name: string | null
          id: string
          ml_closed_at: string | null
          ml_item_id: string
          paused_reason: string | null
          permalink: string | null
          price: number | null
          published_at: string | null
          status: string | null
          stock_synced_at: string | null
          thumbnail: string | null
          title: string
          updated_at: string | null
          user_id: string
          variation_group_id: string | null
          variation_name: string | null
          variation_value: string | null
        }
        Insert: {
          catalog_product_id?: string | null
          cj_product_id?: string | null
          cj_product_url?: string | null
          cj_variant_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          family_name?: string | null
          id?: string
          ml_closed_at?: string | null
          ml_item_id: string
          paused_reason?: string | null
          permalink?: string | null
          price?: number | null
          published_at?: string | null
          status?: string | null
          stock_synced_at?: string | null
          thumbnail?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          variation_group_id?: string | null
          variation_name?: string | null
          variation_value?: string | null
        }
        Update: {
          catalog_product_id?: string | null
          cj_product_id?: string | null
          cj_product_url?: string | null
          cj_variant_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          family_name?: string | null
          id?: string
          ml_closed_at?: string | null
          ml_item_id?: string
          paused_reason?: string | null
          permalink?: string | null
          price?: number | null
          published_at?: string | null
          status?: string | null
          stock_synced_at?: string | null
          thumbnail?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          variation_group_id?: string | null
          variation_name?: string | null
          variation_value?: string | null
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
      validapay_webhook_events: {
        Row: {
          amount: number | null
          attempts: number
          charge_id: string | null
          created_at: string
          error: string | null
          event: string
          id: string
          last_attempt_at: string | null
          next_retry_at: string | null
          payload: Json
          payment_id: string | null
          processed: boolean
          retry_exhausted: boolean
          status: string | null
          subscription_id: string | null
        }
        Insert: {
          amount?: number | null
          attempts?: number
          charge_id?: string | null
          created_at?: string
          error?: string | null
          event: string
          id?: string
          last_attempt_at?: string | null
          next_retry_at?: string | null
          payload: Json
          payment_id?: string | null
          processed?: boolean
          retry_exhausted?: boolean
          status?: string | null
          subscription_id?: string | null
        }
        Update: {
          amount?: number | null
          attempts?: number
          charge_id?: string | null
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          last_attempt_at?: string | null
          next_retry_at?: string | null
          payload?: Json
          payment_id?: string | null
          processed?: boolean
          retry_exhausted?: boolean
          status?: string | null
          subscription_id?: string | null
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
      affiliate_generate_code: { Args: { p_user_id: string }; Returns: string }
      apply_pending_referral_rewards: {
        Args: { p_user_id: string }
        Returns: number
      }
      auth_email_exists: { Args: { p_email: string }; Returns: boolean }
      claim_project_invites: { Args: never; Returns: number }
      close_stale_support_tickets: { Args: never; Returns: number }
      current_user_ml_seller_ids: { Args: never; Returns: string[] }
      get_aliexpress_cron_status: {
        Args: never
        Returns: {
          active: boolean
          jobid: number
          jobname: string
          schedule: string
        }[]
      }
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
          meta_pixel_id: string | null
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
          external_sales: number
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
          velo_orders_count: number
          velo_publications_count: number
          velo_recent_orders: number
          velo_revenue: number
          velo_units_sold: number
          viral_score: number
        }[]
      }
      get_user_projects: {
        Args: never
        Returns: {
          created_at: string
          id: string
          last_edited_at: string
          meta_pixel_id: string | null
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
      grant_referral_inviter_months: {
        Args: {
          p_months?: number
          p_payment_ref: string
          p_referral_id: string
        }
        Returns: Json
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
      ml_variation_backfill_candidates: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          email: string
          ml_item_id: string
          price: number
          publication_id: string
          title: string
          user_id: string
          variants: Json
        }[]
      }
      rpc_admin_accept_affiliate_application: {
        Args: { p_user_id: string }
        Returns: Json
      }
      rpc_admin_affiliate_applications: {
        Args: { p_status?: string }
        Returns: Json
      }
      rpc_admin_affiliate_details: {
        Args: { p_from?: string; p_query: string; p_to?: string }
        Returns: Json
      }
      rpc_admin_affiliates_summary: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
      }
      rpc_admin_reject_affiliate_application: {
        Args: { p_user_id: string }
        Returns: Json
      }
      rpc_admin_remove_affiliate: {
        Args: { p_code?: string; p_user_id?: string }
        Returns: Json
      }
      rpc_admin_store_sales: {
        Args: { p_limit?: number; p_status?: string }
        Returns: Json
      }
      rpc_admin_withdrawal_decide: {
        Args: { p_action: string; p_id: string; p_note?: string }
        Returns: Json
      }
      rpc_admin_withdrawal_requests: {
        Args: { p_status?: string }
        Returns: Json
      }
      rpc_affiliate_attach_signup: {
        Args: { p_affiliate_code: string; p_visitor_id?: string }
        Returns: boolean
      }
      rpc_affiliate_cancel_withdrawal: {
        Args: { p_id: string }
        Returns: boolean
      }
      rpc_affiliate_mark_converted: {
        Args: { p_affiliate_code: string; p_user_id: string }
        Returns: boolean
      }
      rpc_affiliate_mark_reached_payment: {
        Args: { p_affiliate_code: string; p_visitor_id?: string }
        Returns: boolean
      }
      rpc_affiliate_request_withdrawal: {
        Args: { p_pix_key?: string; p_pix_key_type?: string }
        Returns: Json
      }
      rpc_affiliate_subscriber_names: {
        Args: never
        Returns: {
          display_name: string
          email: string
          subscriber_user_id: string
        }[]
      }
      rpc_affiliate_withdrawal_history: {
        Args: never
        Returns: {
          admin_note: string
          amount: number
          cancelled_at: string
          decided_at: string
          id: string
          items_count: number
          paid_at: string
          pix_key_type: string
          requested_at: string
          status: string
        }[]
      }
      rpc_affiliate_withdrawal_summary: { Args: never; Returns: Json }
      rpc_atlas_usage_summary: {
        Args: { p_days?: number }
        Returns: {
          dia: string
          duracao_media_ms: number
          etapa: string
          modelo: string
          origem: string
          respostas: number
          tokens_cache: number
          tokens_entrada: number
          tokens_medio_por_resposta: number
          tokens_saida: number
          tokens_total: number
          usuarios: number
        }[]
      }
      rpc_ml_reconnect_required: { Args: never; Returns: boolean }
      rpc_record_affiliate_visit: {
        Args: {
          p_affiliate_code: string
          p_referrer?: string
          p_user_agent?: string
          p_visitor_id?: string
        }
        Returns: boolean
      }
      set_aliexpress_cron_active: {
        Args: { p_active: boolean }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
      user_has_active_paid_plan: {
        Args: { target_user: string }
        Returns: boolean
      }
      user_has_base_plan: { Args: { check_user_id: string }; Returns: boolean }
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
