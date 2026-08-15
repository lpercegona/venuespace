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
      blog_posts: {
        Row: {
          author_user_id: string | null
          content_html: string
          content_text: string
          cover_image_alt: string | null
          cover_image_path: string | null
          created_at: string
          id: string
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: Database["public"]["Enums"]["blog_post_status"]
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_user_id?: string | null
          content_html?: string
          content_text?: string
          cover_image_alt?: string | null
          cover_image_path?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["blog_post_status"]
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_user_id?: string | null
          content_html?: string
          content_text?: string
          cover_image_alt?: string | null
          cover_image_path?: string | null
          created_at?: string
          id?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["blog_post_status"]
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      category_field_groups: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          key: string
          order_index: number
          scope: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          order_index?: number
          scope: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          order_index?: number
          scope?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_field_groups_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "organization_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_filter_fields: {
        Row: {
          category_id: string
          created_at: string
          field_key: string
          filter_type: string
          id: string
          label_override: string | null
          max_field_key: string | null
          min_field_key: string | null
          order_index: number
          scope: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          field_key: string
          filter_type: string
          id?: string
          label_override?: string | null
          max_field_key?: string | null
          min_field_key?: string | null
          order_index?: number
          scope: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          field_key?: string
          filter_type?: string
          id?: string
          label_override?: string | null
          max_field_key?: string | null
          min_field_key?: string | null
          order_index?: number
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_filter_fields_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "organization_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_labels: {
        Row: {
          category_id: string
          created_at: string
          icon: string | null
          id: string
          key: string
          label: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          icon?: string | null
          id?: string
          key: string
          label: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_labels_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "organization_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_modules: {
        Row: {
          category_id: string
          config: Json
          created_at: string
          id: string
          is_enabled: boolean
          module_key: string
          updated_at: string
        }
        Insert: {
          category_id: string
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_key: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          module_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_modules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "organization_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_modules_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "platform_modules"
            referencedColumns: ["key"]
          },
        ]
      }
      category_org_fields: {
        Row: {
          category_id: string
          config: Json
          created_at: string
          field_key: string
          field_type: string
          group_id: string | null
          id: string
          is_base: boolean
          label: string
          order_index: number
          required: boolean
          updated_at: string
        }
        Insert: {
          category_id: string
          config?: Json
          created_at?: string
          field_key: string
          field_type: string
          group_id?: string | null
          id?: string
          is_base?: boolean
          label: string
          order_index?: number
          required?: boolean
          updated_at?: string
        }
        Update: {
          category_id?: string
          config?: Json
          created_at?: string
          field_key?: string
          field_type?: string
          group_id?: string | null
          id?: string
          is_base?: boolean
          label?: string
          order_index?: number
          required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_org_fields_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "organization_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_org_fields_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "category_field_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      category_public_layout_fields: {
        Row: {
          config: Json
          created_at: string
          field_key: string
          id: string
          layout_id: string
          order_index: number
          width_percent: number
        }
        Insert: {
          config?: Json
          created_at?: string
          field_key: string
          id?: string
          layout_id: string
          order_index?: number
          width_percent: number
        }
        Update: {
          config?: Json
          created_at?: string
          field_key?: string
          id?: string
          layout_id?: string
          order_index?: number
          width_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_public_layout_fields_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "category_public_layouts"
            referencedColumns: ["id"]
          },
        ]
      }
      category_public_layouts: {
        Row: {
          card_style: string
          category_id: string
          id: string
          scope: Database["public"]["Enums"]["public_layout_scope"]
          updated_at: string
        }
        Insert: {
          card_style?: string
          category_id: string
          id?: string
          scope: Database["public"]["Enums"]["public_layout_scope"]
          updated_at?: string
        }
        Update: {
          card_style?: string
          category_id?: string
          id?: string
          scope?: Database["public"]["Enums"]["public_layout_scope"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_public_layouts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "organization_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_standard_form_fields: {
        Row: {
          config: Json
          created_at: string
          field_key: string
          field_type: string
          form_id: string
          id: string
          label: string
          order_index: number
          required: boolean
          source_standard_field_key: string | null
          updated_at: string
          visible: boolean
        }
        Insert: {
          config?: Json
          created_at?: string
          field_key: string
          field_type: string
          form_id: string
          id?: string
          label: string
          order_index?: number
          required?: boolean
          source_standard_field_key?: string | null
          updated_at?: string
          visible?: boolean
        }
        Update: {
          config?: Json
          created_at?: string
          field_key?: string
          field_type?: string
          form_id?: string
          id?: string
          label?: string
          order_index?: number
          required?: boolean
          source_standard_field_key?: string | null
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "category_standard_form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "category_standard_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      category_standard_forms: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          scope: string
          standard_table_id: string | null
          submit_label: string
          target_standard_table_id: string | null
          target_table_name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          scope: string
          standard_table_id?: string | null
          submit_label?: string
          target_standard_table_id?: string | null
          target_table_name?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          scope?: string
          standard_table_id?: string | null
          submit_label?: string
          target_standard_table_id?: string | null
          target_table_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_standard_forms_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "organization_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_standard_forms_standard_table_id_fkey"
            columns: ["standard_table_id"]
            isOneToOne: false
            referencedRelation: "category_standard_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_standard_forms_target_standard_table_id_fkey"
            columns: ["target_standard_table_id"]
            isOneToOne: false
            referencedRelation: "category_standard_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      category_standard_table_fields: {
        Row: {
          config: Json
          created_at: string
          field_key: string
          field_type: string
          id: string
          label: string
          order_index: number
          required: boolean
          standard_table_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          field_key: string
          field_type: string
          id?: string
          label: string
          order_index?: number
          required?: boolean
          standard_table_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          field_key?: string
          field_type?: string
          id?: string
          label?: string
          order_index?: number
          required?: boolean
          standard_table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_standard_table_fields_standard_table_id_fkey"
            columns: ["standard_table_id"]
            isOneToOne: false
            referencedRelation: "category_standard_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      category_standard_tables: {
        Row: {
          bookable: boolean
          category_id: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_hidden: boolean
          is_public: boolean
          is_system: boolean
          kind: string
          name: string
          order_index: number
          slug: string
          updated_at: string
        }
        Insert: {
          bookable?: boolean
          category_id: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_hidden?: boolean
          is_public?: boolean
          is_system?: boolean
          kind?: string
          name: string
          order_index?: number
          slug: string
          updated_at?: string
        }
        Update: {
          bookable?: boolean
          category_id?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_hidden?: boolean
          is_public?: boolean
          is_system?: boolean
          kind?: string
          name?: string
          order_index?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_standard_tables_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "organization_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_table_fields: {
        Row: {
          category_id: string
          config: Json
          created_at: string
          field_key: string
          field_type: string
          group_id: string | null
          id: string
          is_base: boolean
          label: string
          order_index: number
          required: boolean
          updated_at: string
        }
        Insert: {
          category_id: string
          config?: Json
          created_at?: string
          field_key: string
          field_type: string
          group_id?: string | null
          id?: string
          is_base?: boolean
          label: string
          order_index?: number
          required?: boolean
          updated_at?: string
        }
        Update: {
          category_id?: string
          config?: Json
          created_at?: string
          field_key?: string
          field_type?: string
          group_id?: string | null
          id?: string
          is_base?: boolean
          label?: string
          order_index?: number
          required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_table_fields_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "organization_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_table_fields_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "category_field_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          applicant_user_id: string | null
          created_at: string
          id: string
          lead_email: string | null
          organization_id: string
          record_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          applicant_user_id?: string | null
          created_at?: string
          id?: string
          lead_email?: string | null
          organization_id: string
          record_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          applicant_user_id?: string | null
          created_at?: string
          id?: string
          lead_email?: string | null
          organization_id?: string
          record_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          category_field_key: string | null
          config: Json
          created_at: string
          id: string
          key: string
          label: string
          position: number
          required: boolean
          source: string
          table_id: string
          type: Database["public"]["Enums"]["field_type"]
          updated_at: string
        }
        Insert: {
          category_field_key?: string | null
          config?: Json
          created_at?: string
          id?: string
          key: string
          label: string
          position?: number
          required?: boolean
          source?: string
          table_id: string
          type: Database["public"]["Enums"]["field_type"]
          updated_at?: string
        }
        Update: {
          category_field_key?: string | null
          config?: Json
          created_at?: string
          id?: string
          key?: string
          label?: string
          position?: number
          required?: boolean
          source?: string
          table_id?: string
          type?: Database["public"]["Enums"]["field_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fields_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      home_blocks: {
        Row: {
          block_type: string
          columns: number
          created_at: string
          grouping_id: string
          id: string
          is_active: boolean
          items: Json
          limit_count: number
          order_by: string | null
          order_index: number
          rules: Json
          show_see_all: boolean
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          block_type?: string
          columns?: number
          created_at?: string
          grouping_id: string
          id?: string
          is_active?: boolean
          items?: Json
          limit_count?: number
          order_by?: string | null
          order_index?: number
          rules?: Json
          show_see_all?: boolean
          source: string
          title: string
          updated_at?: string
        }
        Update: {
          block_type?: string
          columns?: number
          created_at?: string
          grouping_id?: string
          id?: string
          is_active?: boolean
          items?: Json
          limit_count?: number
          order_by?: string | null
          order_index?: number
          rules?: Json
          show_see_all?: boolean
          source?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_blocks_grouping_id_fkey"
            columns: ["grouping_id"]
            isOneToOne: false
            referencedRelation: "home_groupings"
            referencedColumns: ["id"]
          },
        ]
      }
      home_grouping_categories: {
        Row: {
          category_id: string
          created_at: string
          grouping_id: string
          id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          grouping_id: string
          id?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          grouping_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_grouping_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "organization_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "home_grouping_categories_grouping_id_fkey"
            columns: ["grouping_id"]
            isOneToOne: false
            referencedRelation: "home_groupings"
            referencedColumns: ["id"]
          },
        ]
      }
      home_groupings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          label: string
          order_index: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          order_index?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          order_index?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      instance_settings: {
        Row: {
          allow_user_field_management: boolean
          currency_display: Json
          default_currency: string
          default_timezone: string
          id: number
          updated_at: string
        }
        Insert: {
          allow_user_field_management?: boolean
          currency_display?: Json
          default_currency?: string
          default_timezone?: string
          id?: number
          updated_at?: string
        }
        Update: {
          allow_user_field_management?: boolean
          currency_display?: Json
          default_currency?: string
          default_timezone?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      lead_access_tokens: {
        Row: {
          conversation_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          organization_id: string
          record_id: string | null
          token: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          organization_id: string
          record_id?: string | null
          token: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          organization_id?: string
          record_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_access_tokens_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_access_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_access_tokens_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          organization_id: string
          proposal_status: string | null
          proposed_value: number | null
          read_at: string | null
          sender_email: string | null
          sender_role: string
          sender_user_id: string | null
          type: string
        }
        Insert: {
          body?: string
          conversation_id: string
          created_at?: string
          id?: string
          organization_id: string
          proposal_status?: string | null
          proposed_value?: number | null
          read_at?: string | null
          sender_email?: string | null
          sender_role?: string
          sender_user_id?: string | null
          type?: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          proposal_status?: string | null
          proposed_value?: number | null
          read_at?: string | null
          sender_email?: string | null
          sender_role?: string
          sender_user_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_categories: {
        Row: {
          allow_custom_tables: boolean
          base_field_config: Json
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          allow_custom_tables?: boolean
          base_field_config?: Json
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          allow_custom_tables?: boolean
          base_field_config?: Json
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_category_default_fields: {
        Row: {
          category_id: string
          config: Json
          created_at: string
          field_key: string
          field_type: string
          group_id: string | null
          id: string
          is_base: boolean
          label: string
          order_index: number
          required: boolean
        }
        Insert: {
          category_id: string
          config?: Json
          created_at?: string
          field_key: string
          field_type: string
          group_id?: string | null
          id?: string
          is_base?: boolean
          label: string
          order_index?: number
          required?: boolean
        }
        Update: {
          category_id?: string
          config?: Json
          created_at?: string
          field_key?: string
          field_type?: string
          group_id?: string | null
          id?: string
          is_base?: boolean
          label?: string
          order_index?: number
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "organization_category_default_fields_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "organization_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_category_default_fields_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "category_field_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_fields: {
        Row: {
          config: Json
          created_at: string
          id: string
          key: string
          label: string
          position: number
          required: boolean
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          key: string
          label: string
          position?: number
          required?: boolean
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          key?: string
          label?: string
          position?: number
          required?: boolean
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          organization_id: string
          rating: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          organization_id: string
          rating: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          rating?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_reviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: Json
          category_data: Json
          category_id: string
          created_at: string
          created_by: string
          currency: string | null
          currency_display: Json | null
          description: string | null
          id: string
          is_public: boolean
          logo_url: string | null
          name: string
          slug: string
          system_data: Json
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: Json
          category_data?: Json
          category_id: string
          created_at?: string
          created_by: string
          currency?: string | null
          currency_display?: Json | null
          description?: string | null
          id?: string
          is_public?: boolean
          logo_url?: string | null
          name: string
          slug: string
          system_data?: Json
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json
          category_data?: Json
          category_id?: string
          created_at?: string
          created_by?: string
          currency?: string | null
          currency_display?: Json | null
          description?: string | null
          id?: string
          is_public?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          system_data?: Json
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "organization_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          table_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          table_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          table_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_labels: {
        Row: {
          icon: string | null
          key: string
          label: string
          updated_at: string
        }
        Insert: {
          icon?: string | null
          key: string
          label: string
          updated_at?: string
        }
        Update: {
          icon?: string | null
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_modules: {
        Row: {
          created_at: string
          description: string | null
          is_active: boolean
          key: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_active?: boolean
          key: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          is_active?: boolean
          key?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      record_fields: {
        Row: {
          config: Json
          created_at: string
          id: string
          key: string
          label: string
          position: number
          required: boolean
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          key: string
          label: string
          position?: number
          required?: boolean
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          key?: string
          label?: string
          position?: number
          required?: boolean
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      records: {
        Row: {
          agreed_value: number | null
          applicant_user_id: string | null
          contribution_status:
            | Database["public"]["Enums"]["contribution_status"]
            | null
          created_at: string
          created_by: string | null
          data: Json
          deal_status: Database["public"]["Enums"]["deal_status"]
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["record_status"]
          system_data: Json
          table_id: string
          updated_at: string
        }
        Insert: {
          agreed_value?: number | null
          applicant_user_id?: string | null
          contribution_status?:
            | Database["public"]["Enums"]["contribution_status"]
            | null
          created_at?: string
          created_by?: string | null
          data?: Json
          deal_status?: Database["public"]["Enums"]["deal_status"]
          id?: string
          organization_id: string
          status?: Database["public"]["Enums"]["record_status"]
          system_data?: Json
          table_id: string
          updated_at?: string
        }
        Update: {
          agreed_value?: number | null
          applicant_user_id?: string | null
          contribution_status?:
            | Database["public"]["Enums"]["contribution_status"]
            | null
          created_at?: string
          created_by?: string | null
          data?: Json
          deal_status?: Database["public"]["Enums"]["deal_status"]
          id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["record_status"]
          system_data?: Json
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "records_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          email: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          user_id?: string
        }
        Relationships: []
      }
      table_fields: {
        Row: {
          config: Json
          created_at: string
          id: string
          key: string
          label: string
          position: number
          required: boolean
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          key: string
          label: string
          position?: number
          required?: boolean
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          key?: string
          label?: string
          position?: number
          required?: boolean
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      tables: {
        Row: {
          bookable: boolean
          category_data: Json
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_hidden: boolean
          is_locked: boolean
          is_public: boolean
          is_system: boolean
          name: string
          organization_id: string
          origin_standard_form_id: string | null
          origin_standard_table_id: string | null
          slug: string
          system_data: Json
          updated_at: string
        }
        Insert: {
          bookable?: boolean
          category_data?: Json
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_hidden?: boolean
          is_locked?: boolean
          is_public?: boolean
          is_system?: boolean
          name: string
          organization_id: string
          origin_standard_form_id?: string | null
          origin_standard_table_id?: string | null
          slug: string
          system_data?: Json
          updated_at?: string
        }
        Update: {
          bookable?: boolean
          category_data?: Json
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_hidden?: boolean
          is_locked?: boolean
          is_public?: boolean
          is_system?: boolean
          name?: string
          organization_id?: string
          origin_standard_form_id?: string | null
          origin_standard_table_id?: string | null
          slug?: string
          system_data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tables_origin_standard_table_id_fkey"
            columns: ["origin_standard_table_id"]
            isOneToOne: false
            referencedRelation: "category_standard_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      views: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          origin_standard_form_id: string | null
          submissions_table_id: string | null
          table_id: string
          type: Database["public"]["Enums"]["view_type"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          origin_standard_form_id?: string | null
          submissions_table_id?: string | null
          table_id: string
          type?: Database["public"]["Enums"]["view_type"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          origin_standard_form_id?: string | null
          submissions_table_id?: string | null
          table_id?: string
          type?: Database["public"]["Enums"]["view_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "views_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "views_submissions_table_id_fkey"
            columns: ["submissions_table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "views_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_standard_fields_to_table: {
        Args: { _standard_table_id: string; _table_id: string }
        Returns: undefined
      }
      apply_standard_forms_to_org: {
        Args: { _category_id: string; _org_id: string }
        Returns: undefined
      }
      can_edit_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      create_organization: {
        Args: {
          _address?: Json
          _category_id: string
          _description?: string
          _name: string
          _slug: string
        }
        Returns: {
          id: string
          name: string
          slug: string
        }[]
      }
      ensure_bookings_table: {
        Args: { _source_table_id: string }
        Returns: string
      }
      ensure_contacts_table: { Args: { _org_id: string }; Returns: string }
      has_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin_email: { Args: { _email: string }; Returns: boolean }
      reconcile_org_category_fields: {
        Args: { _org_id: string }
        Returns: {
          fields_added: number
          tables_touched: number
        }[]
      }
      set_deal_status_guarded: {
        Args: {
          _agreed_value?: number
          _end_key?: string
          _record_id: string
          _start_key?: string
          _status: Database["public"]["Enums"]["deal_status"]
        }
        Returns: undefined
      }
      sync_category_standard_forms: {
        Args: { _category_id: string }
        Returns: {
          orgs_touched: number
        }[]
      }
      sync_category_standard_tables: {
        Args: { _category_id: string }
        Returns: {
          fields_added: number
          fields_removed: number
          orgs_touched: number
          tables_created: number
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "editor" | "viewer"
      blog_post_status: "draft" | "published"
      contribution_status: "none" | "pledged" | "confirmed" | "refunded"
      deal_status: "none" | "negotiating" | "accepted" | "declined" | "closed"
      field_source_kind:
        | "org_field"
        | "table_field"
        | "record_field"
        | "record_data_field"
      field_type:
        | "text"
        | "long_text"
        | "number"
        | "currency"
        | "boolean"
        | "date"
        | "datetime"
        | "select"
        | "multiselect"
        | "email"
        | "phone"
        | "url"
        | "image"
        | "file"
        | "relation"
        | "computed"
        | "gallery"
      public_layout_scope:
        | "organization_card"
        | "record_card"
        | "organization_page"
      record_status: "draft" | "published" | "archived"
      view_type: "grid" | "public_list" | "public_detail" | "public_form"
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
      app_role: ["owner", "editor", "viewer"],
      blog_post_status: ["draft", "published"],
      contribution_status: ["none", "pledged", "confirmed", "refunded"],
      deal_status: ["none", "negotiating", "accepted", "declined", "closed"],
      field_source_kind: [
        "org_field",
        "table_field",
        "record_field",
        "record_data_field",
      ],
      field_type: [
        "text",
        "long_text",
        "number",
        "currency",
        "boolean",
        "date",
        "datetime",
        "select",
        "multiselect",
        "email",
        "phone",
        "url",
        "image",
        "file",
        "relation",
        "computed",
        "gallery",
      ],
      public_layout_scope: [
        "organization_card",
        "record_card",
        "organization_page",
      ],
      record_status: ["draft", "published", "archived"],
      view_type: ["grid", "public_list", "public_detail", "public_form"],
    },
  },
} as const
