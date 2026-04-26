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
      catalog_products: {
        Row: {
          category: string | null
          cost_price: number
          created_at: string | null
          description: string | null
          external_id: string
          id: string
          images: Json | null
          is_active: boolean | null
          margin_percent: number
          orders_count: number | null
          original_price: number | null
          rating: number | null
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
          category?: string | null
          cost_price: number
          created_at?: string | null
          description?: string | null
          external_id: string
          id?: string
          images?: Json | null
          is_active?: boolean | null
          margin_percent: number
          orders_count?: number | null
          original_price?: number | null
          rating?: number | null
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
          category?: string | null
          cost_price?: number
          created_at?: string | null
          description?: string | null
          external_id?: string
          id?: string
          images?: Json | null
          is_active?: boolean | null
          margin_percent?: number
          orders_count?: number | null
          original_price?: number | null
          rating?: number | null
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
      notifications: {
        Row: {
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
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_state: string | null
          buyer_zip: string | null
          cj_order_id: string | null
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
          raw: Json | null
          sale_price: number
          status: string
          total_amount: number | null
          tracking_code: string | null
          user_id: string
        }
        Insert: {
          buyer_address?: string | null
          buyer_city?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_state?: string | null
          buyer_zip?: string | null
          cj_order_id?: string | null
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
          raw?: Json | null
          sale_price?: number
          status?: string
          total_amount?: number | null
          tracking_code?: string | null
          user_id: string
        }
        Update: {
          buyer_address?: string | null
          buyer_city?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_state?: string | null
          buyer_zip?: string | null
          cj_order_id?: string | null
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
          raw?: Json | null
          sale_price?: number
          status?: string
          total_amount?: number | null
          tracking_code?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          nicho: string | null
          plano: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          nicho?: string | null
          plano?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          nicho?: string | null
          plano?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
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
      subscriptions: {
        Row: {
          amount: number
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          mp_payment_id: string | null
          mp_subscription_id: string | null
          payment_method: string | null
          plan: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mp_payment_id?: string | null
          mp_subscription_id?: string | null
          payment_method?: string | null
          plan?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mp_payment_id?: string | null
          mp_subscription_id?: string | null
          payment_method?: string | null
          plan?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_publications: {
        Row: {
          cost_price: number | null
          created_at: string | null
          id: string
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
          cost_price?: number | null
          created_at?: string | null
          id?: string
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
          cost_price?: number | null
          created_at?: string | null
          id?: string
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
    Enums: {},
  },
} as const
