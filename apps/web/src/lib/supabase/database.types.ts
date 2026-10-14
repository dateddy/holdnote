export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      ai_usage: {
        Row: {
          billed_to: string;
          cost_usd: number;
          created_at: string;
          id: string;
          kind: string;
          model: string;
          tokens_in: number;
          tokens_out: number;
          user_id: string;
        };
        Insert: {
          billed_to?: string;
          cost_usd?: number;
          created_at?: string;
          id?: string;
          kind: string;
          model: string;
          tokens_in?: number;
          tokens_out?: number;
          user_id: string;
        };
        Update: {
          billed_to?: string;
          cost_usd?: number;
          created_at?: string;
          id?: string;
          kind?: string;
          model?: string;
          tokens_in?: number;
          tokens_out?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      hands: {
        Row: {
          actions: Json;
          ante: number | null;
          ante_mode: string | null;
          board: string[] | null;
          created_at: string;
          eff_stack: number | null;
          flagged: boolean;
          hero_cards: string[] | null;
          hero_pos: string | null;
          hero_stack: number | null;
          id: string;
          level_bb: number | null;
          missing_data: boolean;
          num: number;
          opponent_id: string | null;
          outcome: string | null;
          players_dealt: number | null;
          players_left: number | null;
          pot_final: number | null;
          question: string | null;
          raw_line: string | null;
          result: number | null;
          session_id: string;
          stage: string | null;
          tags: string[];
          thought: string | null;
          updated_at: string;
          user_id: string;
          villain_cards: string[] | null;
          villain_pos: string | null;
          villain_stack: number | null;
        };
        Insert: {
          actions?: Json;
          ante?: number | null;
          ante_mode?: string | null;
          board?: string[] | null;
          created_at?: string;
          eff_stack?: number | null;
          flagged?: boolean;
          hero_cards?: string[] | null;
          hero_pos?: string | null;
          hero_stack?: number | null;
          id?: string;
          level_bb?: number | null;
          missing_data?: boolean;
          num: number;
          opponent_id?: string | null;
          outcome?: string | null;
          players_dealt?: number | null;
          players_left?: number | null;
          pot_final?: number | null;
          question?: string | null;
          raw_line?: string | null;
          result?: number | null;
          session_id: string;
          stage?: string | null;
          tags?: string[];
          thought?: string | null;
          updated_at?: string;
          user_id?: string;
          villain_cards?: string[] | null;
          villain_pos?: string | null;
          villain_stack?: number | null;
        };
        Update: {
          actions?: Json;
          ante?: number | null;
          ante_mode?: string | null;
          board?: string[] | null;
          created_at?: string;
          eff_stack?: number | null;
          flagged?: boolean;
          hero_cards?: string[] | null;
          hero_pos?: string | null;
          hero_stack?: number | null;
          id?: string;
          level_bb?: number | null;
          missing_data?: boolean;
          num?: number;
          opponent_id?: string | null;
          outcome?: string | null;
          players_dealt?: number | null;
          players_left?: number | null;
          pot_final?: number | null;
          question?: string | null;
          raw_line?: string | null;
          result?: number | null;
          session_id?: string;
          stage?: string | null;
          tags?: string[];
          thought?: string | null;
          updated_at?: string;
          user_id?: string;
          villain_cards?: string[] | null;
          villain_pos?: string | null;
          villain_stack?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'hands_opponent_id_user_id_fkey';
            columns: ['opponent_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'opponents';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'hands_session_id_user_id_fkey';
            columns: ['session_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      opponents: {
        Row: {
          id: string;
          name: string;
          notes: string | null;
          player_type: string | null;
          updated_at: string;
          user_id: string;
          venue: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          notes?: string | null;
          player_type?: string | null;
          updated_at?: string;
          user_id?: string;
          venue?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          notes?: string | null;
          player_type?: string | null;
          updated_at?: string;
          user_id?: string;
          venue?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          currency: string;
          display_name: string | null;
          display_unit: string;
          entry_mode: string;
          id: string;
          locale: string;
          onboarded_at: string | null;
          plan: string;
          play_kind: string | null;
          play_mode: string | null;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          display_name?: string | null;
          display_unit?: string;
          entry_mode?: string;
          id: string;
          locale?: string;
          onboarded_at?: string | null;
          plan?: string;
          play_kind?: string | null;
          play_mode?: string | null;
        };
        Update: {
          created_at?: string;
          currency?: string;
          display_name?: string | null;
          display_unit?: string;
          entry_mode?: string;
          id?: string;
          locale?: string;
          onboarded_at?: string | null;
          plan?: string;
          play_kind?: string | null;
          play_mode?: string | null;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          accepted: boolean;
          created_at: string;
          error_tags: string[];
          ev_verdict: string | null;
          hand_id: string;
          icm_text: string | null;
          id: string;
          is_current: boolean;
          lesson: string | null;
          line_text: string | null;
          math_text: string | null;
          model: string | null;
          range_text: string | null;
          source: string;
          user_id: string;
        };
        Insert: {
          accepted?: boolean;
          created_at?: string;
          error_tags?: string[];
          ev_verdict?: string | null;
          hand_id: string;
          icm_text?: string | null;
          id?: string;
          is_current?: boolean;
          lesson?: string | null;
          line_text?: string | null;
          math_text?: string | null;
          model?: string | null;
          range_text?: string | null;
          source: string;
          user_id?: string;
        };
        Update: {
          accepted?: boolean;
          created_at?: string;
          error_tags?: string[];
          ev_verdict?: string | null;
          hand_id?: string;
          icm_text?: string | null;
          id?: string;
          is_current?: boolean;
          lesson?: string | null;
          line_text?: string | null;
          math_text?: string | null;
          model?: string | null;
          range_text?: string | null;
          source?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_hand_id_user_id_fkey';
            columns: ['hand_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'hands';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
      sessions: {
        Row: {
          ante: number | null;
          ante_mode: string;
          bb: number | null;
          buyin: number | null;
          cashout: number | null;
          created_at: string;
          currency: string;
          date: string;
          end_at: string | null;
          id: string;
          kind: string;
          mode: string;
          mtt: Json | null;
          sb: number | null;
          seats: number | null;
          self_state: string | null;
          stake_label: string | null;
          start_at: string | null;
          stop_loss: number | null;
          straddle: number | null;
          summary: Json | null;
          table_read: Json;
          updated_at: string;
          user_id: string;
          venue: string | null;
        };
        Insert: {
          ante?: number | null;
          ante_mode?: string;
          bb?: number | null;
          buyin?: number | null;
          cashout?: number | null;
          created_at?: string;
          currency: string;
          date?: string;
          end_at?: string | null;
          id?: string;
          kind: string;
          mode: string;
          mtt?: Json | null;
          sb?: number | null;
          seats?: number | null;
          self_state?: string | null;
          stake_label?: string | null;
          start_at?: string | null;
          stop_loss?: number | null;
          straddle?: number | null;
          summary?: Json | null;
          table_read?: Json;
          updated_at?: string;
          user_id?: string;
          venue?: string | null;
        };
        Update: {
          ante?: number | null;
          ante_mode?: string;
          bb?: number | null;
          buyin?: number | null;
          cashout?: number | null;
          created_at?: string;
          currency?: string;
          date?: string;
          end_at?: string | null;
          id?: string;
          kind?: string;
          mode?: string;
          mtt?: Json | null;
          sb?: number | null;
          seats?: number | null;
          self_state?: string | null;
          stake_label?: string | null;
          start_at?: string | null;
          stop_loss?: number | null;
          straddle?: number | null;
          summary?: Json | null;
          table_read?: Json;
          updated_at?: string;
          user_id?: string;
          venue?: string | null;
        };
        Relationships: [];
      };
      user_api_keys: {
        Row: {
          created_at: string;
          model: string | null;
          provider: string;
          user_id: string;
          vault_secret_id: string;
        };
        Insert: {
          created_at?: string;
          model?: string | null;
          provider: string;
          user_id: string;
          vault_secret_id: string;
        };
        Update: {
          created_at?: string;
          model?: string | null;
          provider?: string;
          user_id?: string;
          vault_secret_id?: string;
        };
        Relationships: [];
      };
      user_rules: {
        Row: {
          active: boolean;
          id: string;
          sort: number;
          source_session_id: string | null;
          text: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          id?: string;
          sort?: number;
          source_session_id?: string | null;
          text: string;
          user_id?: string;
        };
        Update: {
          active?: boolean;
          id?: string;
          sort?: number;
          source_session_id?: string | null;
          text?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_rules_source_session_id_user_id_fkey';
            columns: ['source_session_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id', 'user_id'];
          },
        ];
      };
    };
    Views: {
      leak_stats: {
        Row: {
          hand_count: number | null;
          session_date: string | null;
          session_id: string | null;
          source: string | null;
          tag: string | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      ai_app_spend_since: { Args: { p_since: string }; Returns: number };
      delete_user_api_key: { Args: { p_user: string }; Returns: undefined };
      get_user_api_key: {
        Args: { p_user: string };
        Returns: {
          api_key: string;
          model: string;
        }[];
      };
      replace_current_review: {
        Args: { p_hand_id: string; p_review: Json };
        Returns: string;
      };
      set_user_api_key: {
        Args: { p_key: string; p_model: string; p_user: string };
        Returns: undefined;
      };
      valid_cards: {
        Args: { cards: string[]; max_len: number };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
