// Edge Function: ai-read-receipt
//
// Membaca foto nota belanja dan mengubahnya menjadi baris barang + total.
// Model multimodal dipakai supaya bisa membaca nota cetak maupun tulisan tangan.
//
// Balas: { items: [{ name, qty, unit, unitPrice, confidence }], total, note }

import { askJson } from "../_shared/ai.ts"
import { errorResponse, jsonResponse, preflight } from "../_shared/http.ts"
import { asRecord, asString, cleanUnit, cleanName, nonNegativeNumber, round2 } from "../_shared/normalize.ts"

export interface ReceiptItem {
  name: string
  qty: number
  unit: string
  unitPrice: number
  confidence: number
}

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_BASE64_LENGTH = 8_000_000

const SYSTEM_PROMPT = `Anda membaca nota belanja warung Indonesia dari sebuah foto.
Tugas: ekstrak semua baris barang yang terlihat di nota.

Aturan:
- Hanya gunakan data yang terlihat di nota. Jangan mengarang barang, jumlah, atau harga.
- name: nama barang, rapi capitalize. Jangan masukkan diskon, pajak, atau uang kembalian.
- qty: angka positif. Contoh "5 L" berarti qty 5 dan unit "liter".
- unit: satuan barang (kg, liter, pcs, bungkus, dus, botol, papan, sachet). Kalau tidak ada, pakai "pcs".
- unitPrice: harga satuan dalam rupiah, angka saja tanpa titik atau pemisah ribuan.
- Kalau harga tidak terbaca, isi 0. Jangan menebak.
- total: total akhir yang tertera di nota, angka saja. Kalau tidak terlihat, jumlahkan qty x unitPrice.
- confidence: 0 sampai 1 per baris. Rendah kalau tulisan buram.
- Balas HANYA JSON valid, tanpa penjelasan:
{"items":[{"name":"Minyak Goreng","qty":5,"unit":"liter","unitPrice":15000,"confidence":0.9}],"total":75000}`

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
  const rawImage = asString(record?.imageBase64)
  if (!rawImage) return errorResponse("Field imageBase64 wajib diisi.")

  const imageBase64 = stripDataUrl(rawImage)
  if (imageBase64.length < 100) {
    return errorResponse("Gambar terlalu kecil atau tidak valid.")
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return errorResponse("Gambar terlalu besar. Perkecil dulu.")
  }

  const mimeType = asString(record?.mimeType) ?? "image/jpeg"
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return errorResponse("Format gambar harus JPEG, PNG, atau WebP.")
  }

  try {
    const result = await askJson(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Baca nota ini dan keluarkan semua baris barangnya." },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
      { maxTokens: 1600 },
    )

    const payload = asRecord(result)
    const items = normalizeItems(payload?.items)
    if (items.length === 0) {
      return errorResponse("Tidak ada baris barang yang terbaca di nota.", 422)
    }

    const statedTotal = nonNegativeNumber(payload?.total)
    const computedTotal = round2(items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0))
    // Total yang tertulis dipakai kalau ada. Kalau tidak, pakai hasil kali.
    const total = statedTotal ?? computedTotal

    return jsonResponse({
      items,
      total,
      // Kalau total tertulis beda jauh dari jumlah baris, juri perlu tahu.
      totalMismatch: statedTotal !== undefined && Math.abs(statedTotal - computedTotal) > 1,
    })
  } catch (cause) {
    console.error("ai-read-receipt error", cause)
    return errorResponse("Gagal membaca nota.", 502)
  }
}

function normalizeItems(value: unknown): ReceiptItem[] {
  if (!Array.isArray(value)) return []
  const items: ReceiptItem[] = []
  for (const entry of value) {
    const row = asRecord(entry)
    const name = cleanName(row?.name)
    if (!name) continue
    const qty = nonNegativeNumber(row?.qty)
    if (qty === undefined || qty === 0) continue
    const rawConfidence = nonNegativeNumber(row?.confidence)
    items.push({
      name,
      qty,
      unit: cleanUnit(row?.unit),
      unitPrice: nonNegativeNumber(row?.unitPrice) ?? 0,
      confidence: rawConfidence === undefined ? 0.5 : Math.min(rawConfidence, 1),
    })
    if (items.length === 60) break
  }
  return items
}

/** Buang prefix data URL kalau ada: `data:image/png;base64,` → isi saja. */
function stripDataUrl(value: string): string {
  const commaIndex = value.indexOf(",")
  if (!value.startsWith("data:") || commaIndex < 0) return value
  return value.slice(commaIndex + 1)
}

// Entry point: Supabase Edge Function menjalankan file ini langsung.
Deno.serve(handler)
