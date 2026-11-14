/**
 * Klien Supabase.
 *
 * Kalau environment belum diisi, aplikasi tetap jalan dalam mode demo lokal
 * (data di localStorage). Jadi `supabase` boleh null — pemanggilnya yang
 * memeriksa.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export const modeDemoLokal = supabase === null

/** Nama Edge Function yang dipakai aplikasi. */
export const EDGE_FUNCTIONS = {
  ekstrakSuara: "ai-extract-voice",
  bacaNota: "ai-read-receipt",
  saran: "ai-advise",
} as const
