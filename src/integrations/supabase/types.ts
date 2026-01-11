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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          inspection_frequency: string
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          inspection_frequency?: string
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          inspection_frequency?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_renewals: {
        Row: {
          certificate_id: string
          created_at: string
          id: string
          new_expiry_date: string
          new_file_path: string | null
          notes: string | null
          old_file_path: string | null
          previous_expiry_date: string | null
          renewed_at: string
          renewed_by: string | null
        }
        Insert: {
          certificate_id: string
          created_at?: string
          id?: string
          new_expiry_date: string
          new_file_path?: string | null
          notes?: string | null
          old_file_path?: string | null
          previous_expiry_date?: string | null
          renewed_at?: string
          renewed_by?: string | null
        }
        Update: {
          certificate_id?: string
          created_at?: string
          id?: string
          new_expiry_date?: string
          new_file_path?: string | null
          notes?: string | null
          old_file_path?: string | null
          previous_expiry_date?: string | null
          renewed_at?: string
          renewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificate_renewals_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          certificate_number: string | null
          created_at: string
          created_by: string | null
          equipment_id: string
          expiry_date: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          id: string
          issue_date: string | null
          issuer: string | null
          last_renewal_date: string | null
          name: string
          notes: string | null
          organization_id: string | null
          renewal_date: string | null
          renewal_notes: string | null
          renewal_status: string | null
          renewed_by: string | null
          ship_id: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          certificate_number?: string | null
          created_at?: string
          created_by?: string | null
          equipment_id: string
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          last_renewal_date?: string | null
          name: string
          notes?: string | null
          organization_id?: string | null
          renewal_date?: string | null
          renewal_notes?: string | null
          renewal_status?: string | null
          renewed_by?: string | null
          ship_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          certificate_number?: string | null
          created_at?: string
          created_by?: string | null
          equipment_id?: string
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          last_renewal_date?: string | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          renewal_date?: string | null
          renewal_notes?: string | null
          renewal_status?: string | null
          renewed_by?: string | null
          ship_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_ship_id_fkey"
            columns: ["ship_id"]
            isOneToOne: false
            referencedRelation: "ships"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          created_at: string
          description: string
          id: string
          is_required: boolean | null
          order_index: number
          template_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_required?: boolean | null
          order_index?: number
          template_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_required?: boolean | null
          order_index?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          category_id: string
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean | null
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          acquisition_date: string | null
          capacity: string | null
          category_id: string
          certificate_expiry: string | null
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          internal_code: string
          last_inspection: string | null
          location: string
          manufacturer: string | null
          manufacturing_date: string | null
          model: string | null
          name: string
          next_inspection: string | null
          observations: string | null
          serial_number: string
          ship_id: string | null
          short_code: string | null
          status: string
          type: string
          unit: string
          updated_at: string
        }
        Insert: {
          acquisition_date?: string | null
          capacity?: string | null
          category_id: string
          certificate_expiry?: string | null
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          internal_code: string
          last_inspection?: string | null
          location: string
          manufacturer?: string | null
          manufacturing_date?: string | null
          model?: string | null
          name: string
          next_inspection?: string | null
          observations?: string | null
          serial_number: string
          ship_id?: string | null
          short_code?: string | null
          status?: string
          type: string
          unit: string
          updated_at?: string
        }
        Update: {
          acquisition_date?: string | null
          capacity?: string | null
          category_id?: string
          certificate_expiry?: string | null
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          internal_code?: string
          last_inspection?: string | null
          location?: string
          manufacturer?: string | null
          manufacturing_date?: string | null
          model?: string | null
          name?: string
          next_inspection?: string | null
          observations?: string | null
          serial_number?: string
          ship_id?: string | null
          short_code?: string | null
          status?: string
          type?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_ship_id_fkey"
            columns: ["ship_id"]
            isOneToOne: false
            referencedRelation: "ships"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_documents: {
        Row: {
          created_at: string
          equipment_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          equipment_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          equipment_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_documents_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_transfers: {
        Row: {
          created_at: string
          equipment_id: string
          from_ship_id: string | null
          id: string
          notes: string | null
          reason: string | null
          to_ship_id: string
          transfer_date: string
          transferred_by: string | null
        }
        Insert: {
          created_at?: string
          equipment_id: string
          from_ship_id?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          to_ship_id: string
          transfer_date?: string
          transferred_by?: string | null
        }
        Update: {
          created_at?: string
          equipment_id?: string
          from_ship_id?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          to_ship_id?: string
          transfer_date?: string
          transferred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_transfers_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_transfers_from_ship_id_fkey"
            columns: ["from_ship_id"]
            isOneToOne: false
            referencedRelation: "ships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_transfers_to_ship_id_fkey"
            columns: ["to_ship_id"]
            isOneToOne: false
            referencedRelation: "ships"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_checklist_items: {
        Row: {
          created_at: string
          description: string
          id: string
          inspection_id: string
          notes: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          inspection_id: string
          notes?: string | null
          status: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          inspection_id?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_checklist_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_photos: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          inspection_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          inspection_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          inspection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_photos_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          actions_taken: string | null
          created_at: string
          equipment_id: string
          id: string
          inspection_date: string
          inspector_id: string
          next_inspection_date: string | null
          observations: string | null
          recommendations: string | null
          ship_id: string | null
          signature_data: string | null
          signed_at: string | null
          status: string
        }
        Insert: {
          actions_taken?: string | null
          created_at?: string
          equipment_id: string
          id?: string
          inspection_date?: string
          inspector_id: string
          next_inspection_date?: string | null
          observations?: string | null
          recommendations?: string | null
          ship_id?: string | null
          signature_data?: string | null
          signed_at?: string | null
          status: string
        }
        Update: {
          actions_taken?: string | null
          created_at?: string
          equipment_id?: string
          id?: string
          inspection_date?: string
          inspector_id?: string
          next_inspection_date?: string | null
          observations?: string | null
          recommendations?: string | null
          ship_id?: string | null
          signature_data?: string | null
          signed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_ship_id_fkey"
            columns: ["ship_id"]
            isOneToOne: false
            referencedRelation: "ships"
            referencedColumns: ["id"]
          },
        ]
      }
      login_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      maintenance_logs: {
        Row: {
          completed_at: string
          completed_by: string | null
          created_at: string
          equipment_id: string
          id: string
          maintenance_plan_id: string
          notes: string | null
          status: string
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          equipment_id: string
          id?: string
          maintenance_plan_id: string
          notes?: string | null
          status?: string
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          equipment_id?: string
          id?: string
          maintenance_plan_id?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_maintenance_plan_id_fkey"
            columns: ["maintenance_plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_photos: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          maintenance_request_id: string
          photo_type: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          maintenance_request_id: string
          photo_type?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          maintenance_request_id?: string
          photo_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_photos_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_plans: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          equipment_id: string
          frequency: string
          id: string
          last_completed_date: string | null
          next_due_date: string
          priority: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_id: string
          frequency?: string
          id?: string
          last_completed_date?: string | null
          next_due_date: string
          priority?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_id?: string
          frequency?: string
          id?: string
          last_completed_date?: string | null
          next_due_date?: string
          priority?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_plans_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string
          due_date: string | null
          equipment_id: string
          id: string
          observations: string | null
          parts_used: string | null
          priority: Database["public"]["Enums"]["maintenance_priority"]
          problem_identified: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requested_at: string
          requested_by: string | null
          scheduled_date: string | null
          ship_id: string | null
          started_at: string | null
          started_by: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          title: string
          type: Database["public"]["Enums"]["maintenance_type"]
          updated_at: string
          work_order: string | null
          work_performed: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          equipment_id: string
          id?: string
          observations?: string | null
          parts_used?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          problem_identified?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          scheduled_date?: string | null
          ship_id?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          title: string
          type?: Database["public"]["Enums"]["maintenance_type"]
          updated_at?: string
          work_order?: string | null
          work_performed?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          equipment_id?: string
          id?: string
          observations?: string | null
          parts_used?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          problem_identified?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          scheduled_date?: string | null
          ship_id?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          title?: string
          type?: Database["public"]["Enums"]["maintenance_type"]
          updated_at?: string
          work_order?: string | null
          work_performed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_ship_id_fkey"
            columns: ["ship_id"]
            isOneToOne: false
            referencedRelation: "ships"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          id: string
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          message: string
          organization_id: string | null
          ship_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          message: string
          organization_id?: string | null
          ship_id?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          message?: string
          organization_id?: string | null
          ship_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_ship_id_fkey"
            columns: ["ship_id"]
            isOneToOne: false
            referencedRelation: "ships"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          logo_white_url: string | null
          name: string
          slug: string
          subdomain: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          logo_white_url?: string | null
          name: string
          slug: string
          subdomain: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          logo_white_url?: string | null
          name?: string
          slug?: string
          subdomain?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_owners: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auto_sign_inspections: boolean | null
          avatar_url: string | null
          created_at: string
          default_signature: string | null
          department: string | null
          email: string
          full_name: string
          id: string
          language: string
          notification_app: boolean | null
          notification_email: boolean | null
          onboarding_completed: boolean | null
          organization_id: string | null
          phone: string | null
          position: string | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_sign_inspections?: boolean | null
          avatar_url?: string | null
          created_at?: string
          default_signature?: string | null
          department?: string | null
          email: string
          full_name: string
          id?: string
          language?: string
          notification_app?: boolean | null
          notification_email?: boolean | null
          onboarding_completed?: boolean | null
          organization_id?: string | null
          phone?: string | null
          position?: string | null
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_sign_inspections?: boolean | null
          avatar_url?: string | null
          created_at?: string
          default_signature?: string | null
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          language?: string
          notification_app?: boolean | null
          notification_email?: boolean | null
          onboarding_completed?: boolean | null
          organization_id?: string | null
          phone?: string | null
          position?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ships: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_organizations: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ships: {
        Row: {
          created_at: string
          id: string
          ship_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ship_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ship_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ships_ship_id_fkey"
            columns: ["ship_id"]
            isOneToOne: false
            referencedRelation: "ships"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_users: { Args: { _user_id: string }; Returns: boolean }
      generate_equipment_short_code: { Args: never; Returns: string }
      get_org_branding_by_subdomain: {
        Args: { _subdomain: string }
        Returns: {
          id: string
          is_active: boolean
          logo_url: string
          logo_white_url: string
          name: string
          slug: string
          subdomain: string
        }[]
      }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_ship_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_master: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_technician: { Args: { _user_id: string }; Returns: boolean }
      is_platform_owner: { Args: { _user_id: string }; Returns: boolean }
      user_belongs_to_organization: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_ship_access: {
        Args: { _ship_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "technician"
        | "viewer"
        | "admin_master"
        | "supervisor"
      maintenance_priority: "low" | "medium" | "high" | "critical"
      maintenance_status:
        | "pending"
        | "approved"
        | "in_progress"
        | "completed"
        | "rejected"
      maintenance_type: "preventive" | "corrective"
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
      app_role: ["admin", "technician", "viewer", "admin_master", "supervisor"],
      maintenance_priority: ["low", "medium", "high", "critical"],
      maintenance_status: [
        "pending",
        "approved",
        "in_progress",
        "completed",
        "rejected",
      ],
      maintenance_type: ["preventive", "corrective"],
    },
  },
} as const
