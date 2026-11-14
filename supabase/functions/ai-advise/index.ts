// Edge Function: ai-advise
//
// Data yang masuk sudah dihitung aplikasi (omzet, laba kotor, stok tipis,
// saran beli). Fungsi ini HANYA merapikan bahasa; angka tetap dihitung di kode
// dan dikirim lewat badan request.
//
// Aturan main:
//   - Hanya pakai angka yang ada di DATA. Jangan hitung ulang, jangan karang.
//   - Jangan pernah menyebut "laba bersih". Kalau menyebut laba, sebut "laba kotor".
//   - Setiap tips punya "text" (tindakan) dan "reason" (alasan dari angka).

import { AiError, askJson } from "../_shared/ai.ts"
import { errorResponse, jsonResponse, preflight } from "../_shared/http.ts"
import { asRecord, asString, nonNegativeNumber } from "../_shared/normalize.ts"

export interface AdvisorTip {
  text: string
  reason: string
}

const SYSTEM_PROMPT = `Anda penasihat warung kecil Indonesia.
Tugas: ubah DATA yang sudah dihitung menjadi maksimal 3 tips singkat.

Aturan:
- Gunakan HANYA angka yang ada di DATA. Jangan menghitung ulang, menambah, atau mengarang angka.
- Jangan pernah menyebut "laba bersih". Kalau menyebut laba, sebut "laba kotor".
- Setiap tip punya "text" (tindakan yang bisa dilakukan) dan "reason" (alasan berbasis angka dari DATA).
- Bahasa Indonesia sehari-hari, jelas, dan singkat. Maksimal 2 kalimat per field.
- Jangan memberi janji pasti. Ini estimasi.
- Balas HANYA JSON valid, tanpa penjelasan:
{"tips":[{"text":"Siapkan stok beras.","reason":"Rata-rata terjual 4 kg/hari; stok tersisa 2 kg."}]}`

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
  const data = {
    omzetMingguIni: nonNegativeNumber(record?.omzetMingguIni) ?? 0,
    labaKotorMingguIni: nonNegativeNumber(record?.labaKotorMingguIni) ?? 0,
    stokTipis: Array.isArray(record?.stokTipis) ? record.stokTipis.slice(0, 10) : [],
    saranBeli: Array.isArray(record?.saranBeli) ? record.saranBeli.slice(0, 5) : [],
  }

  try {
    const result = await askJson(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `DATA:\n${JSON.stringify(data, null, 2)}` },
      ],
      { maxTokens: 700 },
    )

    const tips = normalizeTips(asRecord(result)?.tips)
    if (tips.length === 0) {
      return errorResponse("AI tidak menghasilkan saran yang bisa dipakai.", 502)
    }

    return jsonResponse({ tips })
  } catch (cause) {
    console.error("advise error", cause)
    if (cause instanceof AiError) return errorResponse(cause.message, cause.status)
    return errorResponse("Gagal membuat saran.", 502)
  }
}

function normalizeTips(value: unknown): AdvisorTip[] {
  if (!Array.isArray(value)) return []
  const tips: AdvisorTip[] = []
  for (const entry of value) {
    const row = asRecord(entry)
    const text = asString(row?.text)?.trim()
    const reason = asString(row?.reason)?.trim()
    if (text && reason) tips.push({ text, reason })
    if (tips.length === 3) break
  }
  return tips
}

// Entry point: Supabase Edge Function menjalankan file ini langsung.
Deno.serve(handler)
