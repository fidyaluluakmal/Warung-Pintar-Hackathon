import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { SATUAN_TERSEDIA } from "./types"

/**
 * Daftar satuan harus sama di dua tempat:
 *
 *  - `src/lib/types.ts` — satuan yang dipakai katalog dan tampilan.
 *  - `supabase/functions/_shared/normalize.ts` — satuan yang dikenali AI.
 *
 * Kalau satu satuan ada di katalog tapi tidak di daftar AI, AI mengubahnya
 * jadi "pcs". Stok barang jadi tidak cocok dengan katalog dan tidak ada
 * yang memberi tahu.
 */
describe("daftar satuan", () => {
  const sumber = readFileSync(
    new URL("../../supabase/functions/_shared/normalize.ts", import.meta.url),
    "utf8",
  )

  const isiDaftar = (namaSet: string): string[] => {
    const awal = sumber.indexOf(`const ${namaSet} = new Set([`)
    if (awal < 0) return []
    const akhir = sumber.indexOf("])", awal)
    const blok = sumber.slice(awal, akhir)
    return [...blok.matchAll(/"([^"]+)"/g)].map((m) => m[1])
  }

  const satuanAi = isiDaftar("KNOWN_UNITS")

  it("daftar satuan AI ditemukan", () => {
    expect(satuanAi.length).toBeGreaterThan(0)
  })

  it("semua satuan katalog dikenal AI", () => {
    const tidakDikenal = SATUAN_TERSEDIA.filter((s) => !satuanAi.includes(s))
    expect(tidakDikenal).toEqual([])
  })
})
