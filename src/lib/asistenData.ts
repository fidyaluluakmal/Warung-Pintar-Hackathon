/**
 * Penyimpanan data asisten.
 *
 * Dua tempat simpan, satu bentuk data:
 *   - Supabase (mode cloud): tabel `proyek`, `sesi_asisten`, `pesan_asisten`.
 *   - localStorage (mode demo lokal): key yang sama, bentuk yang sama.
 *
 * Halaman tidak perlu tahu sedang menyimpan ke mana — dia cuma panggil
 * antarmuka di bawah ini.
 */

import { supabase } from "./supabase"
import type { PesanAsisten, Proyek, SesiAsisten } from "./types"

const KUNCI = "warung-pintar-asisten-v1"

/**
 * Kunci lama: sesi asisten waktu masih berupa drawer.
 *
 *_drawer_ menyimpan sesi di localStorage. Sekarang sesi ikut database, jadi
 * sesi lama diimpor sekali supaya tidak hilang.
 */
const KUNCI_LAMA = "warung-pintar-sesi-asisten-v1"

/** Semua data asisten untuk satu warung. */
export interface DataAsisten {
  proyek: Proyek[]
  sesi: SesiAsisten[]
  pesan: PesanAsisten[]
}

/** Antarmuka yang dipakai halaman. */
export interface PenyimpananAsisten {
  muat(): Promise<DataAsisten>
  simpanProyek(proyek: Omit<Proyek, "id" | "owner_id" | "dibuat_pada">): Promise<Proyek>
  ubahProyek(id: string, ubah: Partial<Pick<Proyek, "nama" | "instruksi">>): Promise<void>
  hapusProyek(id: string): Promise<void>
  buatSesi(judul: string, proyekId: string | null): Promise<SesiAsisten>
  ubahSesi(id: string, ubah: Partial<Pick<SesiAsisten, "judul" | "proyek_id">>): Promise<void>
  hapusSesi(id: string): Promise<void>
  simpanPesan(pesan: Omit<PesanAsisten, "id" | "owner_id" | "dibuat_pada">): Promise<PesanAsisten>
}

const KOSONG: DataAsisten = { proyek: [], sesi: [], pesan: [] }

/* -------------------------------------------------------------------------- */
/* Mode lokal                                                                 */
/* -------------------------------------------------------------------------- */

function bacaLokal(): DataAsisten {
  if (typeof localStorage === "undefined") return KOSONG
  try {
    const mentah = localStorage.getItem(KUNCI)
    if (!mentah) return KOSONG
    const data = JSON.parse(mentah) as Partial<DataAsisten>
    return {
      proyek: data.proyek ?? [],
      sesi: data.sesi ?? [],
      pesan: data.pesan ?? [],
    }
  } catch {
    return KOSONG
  }
}

function tulisLokal(data: DataAsisten) {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(KUNCI, JSON.stringify(data))
  } catch {
    // Penyimpanan diblokir: data hanya berlaku di sesi ini.
  }
}

function idLokal(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

class PenyimpananLokal implements PenyimpananAsisten {
  async muat(): Promise<DataAsisten> {
    await imporSesiLama()
    return bacaLokal()
  }

  async simpanProyek(input: {
    nama: string
    instruksi: string | null
  }): Promise<Proyek> {
    const proyek: Proyek = {
      id: idLokal("proyek"),
      owner_id: "lokal",
      nama: input.nama,
      instruksi: input.instruksi,
      dibuat_pada: new Date().toISOString(),
    }
    tulisLokal({ ...bacaLokal(), proyek: [proyek, ...bacaLokal().proyek] })
    return proyek
  }

  async ubahProyek(id: string, ubah: Partial<Pick<Proyek, "nama" | "instruksi">>): Promise<void> {
    const lokal = bacaLokal()
    tulisLokal({
      ...lokal,
      proyek: lokal.proyek.map((p) => (p.id === id ? { ...p, ...ubah } : p)),
    })
  }

  async hapusProyek(id: string): Promise<void> {
    const lokal = bacaLokal()
    tulisLokal({
      proyek: lokal.proyek.filter((p) => p.id !== id),
      sesi: lokal.sesi.map((s) => (s.proyek_id === id ? { ...s, proyek_id: null } : s)),
      pesan: lokal.pesan,
    })
  }

  async buatSesi(judul: string, proyekId: string | null): Promise<SesiAsisten> {
    const sekarang = new Date().toISOString()
    const sesi: SesiAsisten = {
      id: idLokal("sesi"),
      owner_id: "lokal",
      judul,
      proyek_id: proyekId,
      dibuat_pada: sekarang,
      diperbarui_pada: sekarang,
    }
    const lokal = bacaLokal()
    tulisLokal({ ...lokal, sesi: [sesi, ...lokal.sesi] })
    return sesi
  }

  async ubahSesi(
    id: string,
    ubah: Partial<Pick<SesiAsisten, "judul" | "proyek_id">>,
  ): Promise<void> {
    const lokal = bacaLokal()
    tulisLokal({
      ...lokal,
      sesi: lokal.sesi.map((s) =>
        s.id === id ? { ...s, ...ubah, diperbarui_pada: new Date().toISOString() } : s,
      ),
    })
  }

  async hapusSesi(id: string): Promise<void> {
    const lokal = bacaLokal()
    tulisLokal({
      ...lokal,
      sesi: lokal.sesi.filter((s) => s.id !== id),
      pesan: lokal.pesan.filter((p) => p.sesi_id !== id),
    })
  }

  async simpanPesan(input: {
    sesi_id: string
    role: "user" | "assistant"
    teks: string
  }): Promise<PesanAsisten> {
    const pesan: PesanAsisten = {
      id: idLokal("pesan"),
      owner_id: "lokal",
      sesi_id: input.sesi_id,
      role: input.role,
      teks: input.teks,
      dibuat_pada: new Date().toISOString(),
    }
    const lokal = bacaLokal()
    tulisLokal({
      ...lokal,
      pesan: [...lokal.pesan, pesan],
      sesi: lokal.sesi.map((s) =>
        s.id === input.sesi_id ? { ...s, diperbarui_pada: pesan.dibuat_pada } : s,
      ),
    })
    return pesan
  }
}

/**
 * Impor sekali sesi dari penyimpanan lama (drawer).
 *
 * Id lamanya bukan uuid, jadi id baru dibiarkan dibuat database. Yang
 * penting: kuncinya HANYA dihapus kalau semua sesi benar-benar tersimpan.
 * Kalau tidak, percakapan lama hilang tanpa ada yang masuk ke database.
 */
async function imporSesiLama(): Promise<void> {
  if (typeof localStorage === "undefined") return
  let lama: Array<{
    id: string
    judul: string
    pesan: Array<{ role: string; text: string }>
  }>
  try {
    const mentah = localStorage.getItem(KUNCI_LAMA)
    if (!mentah) return
    lama = JSON.parse(mentah)
    if (!Array.isArray(lama) || lama.length === 0) {
      localStorage.removeItem(KUNCI_LAMA)
      return
    }
  } catch {
    return
  }

  const tersimpan: string[] = []
  for (const sesi of lama) {
    const pesan = Array.isArray(sesi.pesan) ? sesi.pesan : []
    if (pesan.length === 0) continue
    try {
      const idBaru = await simpanSesiLama({
        judul: sesi.judul || "Sesi lama",
        pesan: pesan.map((p) => ({
          role: p.role === "user" ? "user" : "assistant",
          teks: p.text ?? "",
        })),
      })
      if (idBaru) tersimpan.push(idBaru)
    } catch {
      // Gagal mengimpor satu sesi tidak boleh menggagalkan yang lain.
    }
  }

  // Kunci lama baru dihapus kalau SEMUA sesi berhasil masuk.
  if (tersimpan.length === lama.length) {
    try {
      localStorage.removeItem(KUNCI_LAMA)
    } catch {
      // Penyimpanan diblokir.
    }
  }
}

/**
 * Simpan satu sesi lama ke tempat penyimpanan yang aktif.
 *
 * Balikkan id barunya kalau tersimpan.
 */
async function simpanSesiLama(sesi: {
  judul: string
  pesan: Array<{ role: "user" | "assistant"; teks: string }>
}): Promise<string | null> {
  const dasar = new Date()
  const dibuatPada = (index: number) =>
    new Date(dasar.getTime() + index).toISOString()

  if (!supabase) {
    const lokal = bacaLokal()
    const owner = "lokal"
    const id = idLokal("sesi-lama")
    tulisLokal({
      ...lokal,
      sesi: [
        {
          id,
          owner_id: owner,
          judul: sesi.judul,
          proyek_id: null,
          dibuat_pada: dibuatPada(0),
          diperbarui_pada: dibuatPada(0),
        },
        ...lokal.sesi,
      ],
      pesan: [
        ...lokal.pesan,
        ...sesi.pesan.map((p, index) => ({
          id: idLokal("pesan-lama"),
          owner_id: owner,
          sesi_id: id,
          role: p.role,
          teks: p.teks,
          dibuat_pada: dibuatPada(index),
        })),
      ],
    })
    return id
  }

  const { data: auth } = await supabase.auth.getUser()
  const owner = auth.user?.id
  if (!owner) return null

  const { data: sesiBaru, error: errorSesi } = await supabase
    .from("sesi_asisten")
    .insert({
      owner_id: owner,
      judul: sesi.judul,
      proyek_id: null,
      dibuat_pada: dibuatPada(0),
      diperbarui_pada: dibuatPada(0),
    })
    .select("id")
    .single()
  if (errorSesi) throw errorSesi
  if (!sesiBaru) return null

  const { error: errorPesan } = await supabase.from("pesan_asisten").insert(
    sesi.pesan.map((p, index) => ({
      owner_id: owner,
      sesi_id: sesiBaru.id,
      role: p.role,
      teks: p.teks,
      dibuat_pada: dibuatPada(index),
    })),
  )
  if (errorPesan) throw errorPesan
  return sesiBaru.id
}

/* -------------------------------------------------------------------------- */
/* Supabase                                                                   */
/* -------------------------------------------------------------------------- */

class PenyimpananSupabase implements PenyimpananAsisten {
  /**
   * Id pemilik warung.
   *
   * Wajib ikut di setiap insert: policy RLS menolak baris yang owner_id-nya
   * bukan pemilik sesi ini.
   */
  private async ownerId(): Promise<string> {
    const { data, error } = await supabase!.auth.getUser()
    if (error) throw error
    const id = data.user?.id
    if (!id) throw new Error("Belum masuk, jadi data asisten belum bisa disimpan.")
    return id
  }

  async muat(): Promise<DataAsisten> {
    await imporSesiLama()
    const { data: sesi, error: eSesi } = await supabase!
      .from("sesi_asisten")
      .select("*")
      .order("diperbarui_pada", { ascending: false })
    if (eSesi) throw eSesi

    const { data: proyek, error: eProyek } = await supabase!
      .from("proyek")
      .select("*")
      .order("dibuat_pada", { ascending: false })
    if (eProyek) throw eProyek

    const ids = (sesi ?? []).map((s) => s.id)
    let pesan: PesanAsisten[] = []
    if (ids.length > 0) {
      const { data: dataPesan, error: ePesan } = await supabase!
        .from("pesan_asisten")
        .select("*")
        .in("sesi_id", ids)
        .order("dibuat_pada", { ascending: true })
      if (ePesan) throw ePesan
      pesan = (dataPesan ?? []) as PesanAsisten[]
    }

    return {
      proyek: (proyek ?? []) as Proyek[],
      sesi: (sesi ?? []) as SesiAsisten[],
      pesan,
    }
  }

  async simpanProyek(input: {
    nama: string
    instruksi: string | null
  }): Promise<Proyek> {
    const { data, error } = await supabase!
      .from("proyek")
      .insert({
        owner_id: await this.ownerId(),
        nama: input.nama,
        instruksi: input.instruksi,
      })
      .select()
      .single()
    if (error) throw error
    return data as Proyek
  }

  async ubahProyek(
    id: string,
    ubah: Partial<Pick<Proyek, "nama" | "instruksi">>,
  ): Promise<void> {
    const { error } = await supabase!.from("proyek").update(ubah).eq("id", id)
    if (error) throw error
  }

  async hapusProyek(id: string): Promise<void> {
    const { error } = await supabase!.from("proyek").delete().eq("id", id)
    if (error) throw error
  }

  async buatSesi(judul: string, proyekId: string | null): Promise<SesiAsisten> {
    const { data, error } = await supabase!
      .from("sesi_asisten")
      .insert({
        owner_id: await this.ownerId(),
        judul,
        proyek_id: proyekId,
      })
      .select()
      .single()
    if (error) throw error
    return data as SesiAsisten
  }

  async ubahSesi(
    id: string,
    ubah: Partial<Pick<SesiAsisten, "judul" | "proyek_id">>,
  ): Promise<void> {
    const { error } = await supabase!
      .from("sesi_asisten")
      .update({ ...ubah, diperbarui_pada: new Date().toISOString() })
      .eq("id", id)
    if (error) throw error
  }

  async hapusSesi(id: string): Promise<void> {
    const { error } = await supabase!.from("sesi_asisten").delete().eq("id", id)
    if (error) throw error
  }

  async simpanPesan(input: {
    sesi_id: string
    role: "user" | "assistant"
    teks: string
  }): Promise<PesanAsisten> {
    const { data, error } = await supabase!
      .from("pesan_asisten")
      .insert({
        owner_id: await this.ownerId(),
        sesi_id: input.sesi_id,
        role: input.role,
        teks: input.teks,
      })
      .select()
      .single()
    if (error) throw error

    // Sesi yang baru dipakai harus naik ke atas daftar. Tanpa ini, sesi yang
    // dilanjutkan hari ini tetap tersimpan di tempat lamanya.
    const { error: errorSesi } = await supabase!
      .from("sesi_asisten")
      .update({ diperbarui_pada: new Date().toISOString() })
      .eq("id", input.sesi_id)
    if (errorSesi) throw errorSesi

    return data as PesanAsisten
  }
}

let instance: PenyimpananAsisten | null = null

/** Penyimpanan yang aktif untuk sesi ini. */
export function penyimpananAsisten(): PenyimpananAsisten {
  if (!instance) {
    instance = supabase ? new PenyimpananSupabase() : new PenyimpananLokal()
  }
  return instance
}
