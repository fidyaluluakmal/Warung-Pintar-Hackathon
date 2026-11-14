// Edge Function: ai-ask
//
// Menjawab pertanyaan pemilik warung dari catatan warung itu sendiri.
//
// Angka sudah dihitung aplikasi dan dikirim sebagai konteks. Fungsi ini hanya
// menyusun kalimatnya — tidak pernah menghitung ulang, tidak pernah mengarang
// angka, dan tidak pernah menyebut "laba bersih".

import { askJson } from "../_shared/ai.ts"
import { errorResponse, jsonResponse, preflight } from "../_shared/http.ts"
import { asRecord, asString } from "../_shared/normalize.ts"

const SYSTEM_PROMPT = `Anda asisten pencatatan warung kecil Indonesia.
Tugas: menjawab pertanyaan pemilik warung HANYA dari DATA ringkasan yang diberikan.

Aturan:
- Angka hanya boleh berasal dari DATA. Membandingkan angka yang ada di DATA boleh;
  mengarang, menebak, atau menghitung angka baru yang tidak ada di DATA tidak boleh.
- Kalau DATA tidak cukup untuk menjawab, katakan jujur datanya belum ada dan
  sebut data apa yang tersedia.
- Jangan pernah menyebut "laba bersih". Kalau menyebut laba, sebut "laba kotor".
- Jawab dengan bahasa Indonesia sehari-hari, maksimal 4 kalimat, tanpa bullet.
- Jangan memberi janji pasti. Semua angka adalah estimasi dari catatan.
- Balas HANYA JSON valid, tanpa penjelasan:
{"answer":"Penjualan hari ini Rp150.000 dari 8 transaksi. Stok kopi tinggal 2 sachet."}`

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
  const pertanyaan = asString(record?.question)?.replace(/\s+/g, " ").trim()
  if (!pertanyaan) return errorResponse("Pertanyaan belum diisi.", 400)
  if (pertanyaan.length > 300) return errorResponse("Pertanyaan terlalu panjang.", 400)

  // Konteks berisi angka yang sudah dihitung aplikasi.
  const context = asRecord(record?.context) ?? {}

  try {
    const result = await askJson(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `PERTANYAAN:\n${pertanyaan}\n\nDATA:\n${JSON.stringify(context, null, 2)}`,
        },
      ],
      { maxTokens: 500 },
    )

    const answer = asString(asRecord(result)?.answer)?.replace(/\s+/g, " ").trim()
    if (!answer) {
      return errorResponse("AI tidak menghasilkan jawaban yang bisa dipakai.", 502)
    }

    return jsonResponse({ answer: answer.slice(0, 800) })
  } catch (cause) {
    console.error("ai-ask error", cause)
    return errorResponse("Gagal menjawab pertanyaan.", 502)
  }
}

// Entry point: Supabase Edge Function menjalankan file ini langsung.
Deno.serve(handler)
