/**
 * Lapisan pemanggilan Edge Function.
 *
 * Semua kunci AI ada di server. Frontend hanya mengirim data dan menerima
 * JSON. Kalau AI gagal, pemanggil tetap bisa jatuh ke fallback lokal —
 * angka tidak pernah hilang hanya karena AI sedang tidak bisa jawaban.
 */

import { EDGE_FUNCTIONS, supabase } from "./supabase"
import type { ItemNota, ItemTerEkstrak, TipsAi } from "./types"

export interface HasilEkstrakSuara {
  items: ItemTerEkstrak[]
  needsClarification: string[]
}

export interface HasilBacaNota {
  items: ItemNota[]
  total: number
  totalMismatch: boolean
}

/**
 * Ekstrak barang dari kalimat bahasa Indonesia.
 *
 * `products` dikirim sebagai kamus supaya model memakai nama barang yang
 * benar dan tidak mengarang barang baru.
 */
export async function ekstrakSuara(
  transcript: string,
  products: Array<{ name: string; unit: string; aliases: string[] }>,
): Promise<HasilEkstrakSuara | null> {
  if (!supabase) return null
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTIONS.ekstrakSuara, {
    body: { transcript, products },
  })
  if (error) throw error
  const hasil = data as HasilEkstrakSuara | null
  return hasil ?? null
}

/** Baca foto nota belanja dan dapat baris barang + total. */
export async function bacaNota(imageBase64: string, mimeType: string): Promise<HasilBacaNota | null> {
  if (!supabase) return null
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTIONS.bacaNota, {
    body: { imageBase64, mimeType },
  })
  if (error) throw error
  return (data as HasilBacaNota | null) ?? null
}

/**
 * Minta AI merapikan angka yang sudah dihitung aplikasi.
 *
 * `payload` hanya berisi angka turunan dari database. AI tidak boleh
 * menghitung ulang — tugasnya menyusun bahasa.
 */
export async function mintaSaran(payload: {
  omzetMingguIni: number
  labaKotorMingguIni: number
  stokTipis: Array<{ nama: string; stok: number; satuan: string }>
  saranBeli: Array<{ nama: string; qty: number; satuan: string }>
}): Promise<TipsAi[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTIONS.saran, {
    body: payload,
  })
  if (error) throw error
  const hasil = data as { tips?: TipsAi[] } | null
  return hasil?.tips ?? null
}
