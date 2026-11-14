import { supabase } from "./supabase"

/**
 * Ambil semua baris sebuah tabel, sedikit demi sedikit.
 *
 * PostgREST memotong jawaban di 1000 baris. Kalau tabel lebih besar, baris
 * yang terpotong hilang tanpa tanda — stok jadi negatif, laba kotor salah, dan
 * pelanggan kehilangan barang favorit. Jadi ambil bertahap sampai habis.
 *
 * `urut` = kolom pengurutan. `naik` = true untuk urutan menaik.
 *
 * Pengurutan selalu ada, bahkan kalau pemanggil tidak menyebut kolomnya.
 * Tanpa pengurutan yang tetap, batas antar halaman bisa bergeser dan baris
 * bisa terlewat atau terulang — persis masalah yang fungsi ini dibuat untuk
 * mencegahnya.
 */
export async function ambilSemua<T>(
  tabel: string,
  kolom = "*",
  urut?: string,
  naik = false,
  filter?: { kolom: string; nilai: unknown },
): Promise<T[]> {
  if (!supabase) return []
  const UKURAN = 1000
  const semua: T[] = []
  for (let dari = 0; ; dari += UKURAN) {
    let kueri = supabase.from(tabel).select(kolom).range(dari, dari + UKURAN - 1)
    if (filter) kueri = kueri.eq(filter.kolom, filter.nilai as string)
    // `id` selalu ada dan nilainya unik, jadi pengurutannya selalu tetap.
    kueri = kueri.order(urut ?? "id", { ascending: naik })
    const { data, error } = await kueri
    if (error) throw error
    semua.push(...((data ?? []) as T[]))
    if (!data || data.length < UKURAN) break
  }
  return semua
}
