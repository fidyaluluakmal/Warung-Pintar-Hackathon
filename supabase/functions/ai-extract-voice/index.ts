// Edge Function: ai-extract-voice
//
// Mengubah kalimat bahasa Indonesia menjadi daftar barang siap konfirmasi.
// Frontend mengirim `transcript` (hasil speech-to-text) dan daftar produk
// yang ada, supaya model memakai nama barang yang benar.
//
// Balas: { items: [{ name, qty, unit, confidence }], needsClarification: [] }
// Tanpa `products`, fungsi tetap jalan tapi hanya menebak nama apa adanya.

import { askJson } from "../_shared/ai.ts"
import { errorResponse, jsonResponse, preflight } from "../_shared/http.ts"
import { asRecord, asString, cleanUnit, nonNegativeNumber } from "../_shared/normalize.ts"

export interface ExtractedItem {
  name: string
  qty: number
  unit: string
  confidence: number
}

const SYSTEM_PROMPT = `Anda asisten pencatatan warung kecil Indonesia.
Tugas: baca kalimat salesperson dan keluarkan barang yang terjual.

Aturan:
- Hanya ambil barang yang benar-benar disebut di KALIMAT. Jangan menambah barang.
- name: nama barang dalam bahasa Indonesia, huruf kecil semua. Kalau daftar produk diberikan, pakai nama yang paling mirip dari daftar itu.
- qty: angka positif. "3 kilo" berarti qty 3 dan unit "kg". "1 lusin" berarti qty 1 dan unit "lusin".
- unit: satuan barang (kg, liter, pcs, bungkus, dus, botol, papan, sachet, lusin). Kalau tidak jelas, pakai "pcs".
- confidence: 0 sampai 1. Rendah kalau kalimatnya ambigu.
- Kalau ada bagian yang tidak jelas, taruh kalimatnya di needsClarification.
- Balas HANYA JSON valid, tanpa penjelasan:
{"items":[{"name":"beras","qty":3,"unit":"kg","confidence":0.9}],"needsClarification":[]}`

export async function handler(request: Request): Promise<Response> {
  const options = preflight(request)
  if (options) return options
  if (request.method !== "POST") return errorResponse("Gunakan metode POST.", 405)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse("Body harus berupa JSON.")
  }

  const record = asRecord(body)
  const transcript = asString(record?.transcript)
  if (!transcript) return errorResponse("Field transcript wajib diisi.")
  if (transcript.length > 2000) return errorResponse("Kalimat terlalu panjang.", 413)

  // Daftar produk dipakai model sebagai kamus. Boleh dikosongkan.
  const products = Array.isArray(record?.products) ? record.products.slice(0, 200) : []
  const catalog = products.map((entry) => {
    const row = asRecord(entry)
    const name = asString(row?.name)
    if (!name) return null
    const aliases = Array.isArray(row?.aliases)
      ? row.aliases.filter((alias): alias is string => typeof alias === "string").slice(0, 10)
      : []
    return { name, unit: cleanUnit(row?.unit), aliases }
  })
  const usable = catalog.filter((entry): entry is { name: string; unit: string; aliases: string[] } =>
    entry !== null,
  )

  const userContent = usable.length > 0
    ? `KALIMAT:\n${transcript}\n\nPRODUK YANG TERSEDIA:\n${JSON.stringify(usable, null, 2)}`
    : `KALIMAT:\n${transcript}`

  try {
    const result = await askJson(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      { maxTokens: 900 },
    )

    const payload = asRecord(result)
    const items = normalizeItems(payload?.items)
    if (items.length === 0) {
      return errorResponse("Tidak ada barang yang terbaca dari kalimat itu.", 422)
    }

    const needsClarification = Array.isArray(payload?.needsClarification)
      ? payload.needsClarification
          .map((entry) => asString(entry))
          .filter((entry): entry is string => entry !== undefined)
          .slice(0, 5)
      : []

    return jsonResponse({ items, needsClarification })
  } catch (cause) {
    console.error("ai-extract-voice error", cause)
    return errorResponse("Gagal membaca kalimat.", 502)
  }
}

function normalizeItems(value: unknown): ExtractedItem[] {
  if (!Array.isArray(value)) return []
  const items: ExtractedItem[] = []
  for (const entry of value) {
    const row = asRecord(entry)
    const name = asString(row?.name)
    if (!name) continue
    const qty = nonNegativeNumber(row?.qty)
    if (qty === undefined || qty === 0) continue
    const rawConfidence = nonNegativeNumber(row?.confidence)
    items.push({
      name,
      qty,
      unit: cleanUnit(row?.unit),
      confidence: rawConfidence === undefined ? 0.5 : Math.min(rawConfidence, 1),
    })
    if (items.length === 40) break
  }
  return items
}

// Entry point: Supabase Edge Function menjalankan file ini langsung.
Deno.serve(handler)
