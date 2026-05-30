import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

// Typed helpers
export type Portfolio = {
  id: number; symbol: string; exchange: string; company_name: string;
  qty: number; avg_price: number; buy_date: string; sector: string;
  market_cap: string; notes: string; created_at: string;
};
export type Alert = {
  id: number; symbol: string; exchange: string; condition: string;
  price: number; alert_type: string; cooldown_mins: number;
  remarks: string; tag: string; is_active: boolean;
  triggered_count: number; last_triggered_at: string; created_at: string;
};
export type Watchlist = { id: number; symbol: string; exchange: string; added_at: string };
export type Journal = {
  id: number; trade_date: string; symbol: string; direction: string;
  qty: number; entry_price: number; exit_price: number; pnl: number;
  setup: string; emotion: string; notes: string; created_at: string;
};
export type IntradayTrade = {
  id: number; trade_date: string; symbol: string; exchange: string;
  side: string; qty: number; price: number; notes: string; created_at: string;
};
export type SipEntry = {
  id: number; name: string; symbol: string; exchange: string;
  isin: string; frequency: string; amount: number; start_date: string;
};
