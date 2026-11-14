/**
 * Store data warung.
 *
 * Satu sumber kebenaran untuk seluruh layar: barang, transaksi, dan baris
 * transaksi. Semua komponen membaca dari sini, jadi dua layar tidak pernah
 * menampilkan angka yang berbeda untuk barang yang sama.
 *
 * Mode lokal (tanpa Supabase) memakai localStorage, supaya demo tetap jalan
 * tanpa internet dan tanpa akun.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { supabase, modeDemoLokal } from "./supabase"
import { ambilSemua } from "./supabaseQuery"
import { hitungStok, hitungSaranBeli, round2 } from "./inventory"
import { bagiPembayaran, cariSinyalMargin, type SinyalMargin } from "./margin"
import type {
  Alias,
  BarisTransaksi,
  Barang,
  MarginBarang,
  SaranBeli,
  StokBarang,
  Transaksi,
  UtangBerjalan,
} from "./types"

const KUNCI_LOCAL = "warung-pintar-hackathon-v1"

export interface SesiPengguna {
  userId: string
  email: string
  warung: string
  pemilik: string
}

export interface SimpenDuluInput {
  /** Berapa yang dibayar pelanggan sekarang. Sisanya jadi utang. */
  dibayar: number
  /** Nama panggilan peminjam, mis. "Pak Yono". */
  pelanggan: string
  sumber: Transaksi["sumber"]
  teksMentah?: string
  baris: Array<{
    barangId: string
    jumlah: number
    satuan: string
    hargaSatuan: number
  }>
}

export interface SimpanTransaksiInput {
  tipe: Transaksi["tipe"]
  sumber: Transaksi["sumber"]
  teksMentah?: string
  agen?: string
  baris: Array<{
    barangId: string
    jumlah: number
    satuan: string
    hargaSatuan: number
  }>
}

interface WarungContext {
  siap: boolean
  modeLokal: boolean
  sesi: SesiPengguna | null
  masuk: (email: string, sandi: string) => Promise<void>
  keluar: () => Promise<void>
  barang: Barang[]
  alias: Alias[]
  transaksi: Transaksi[]
  baris: BarisTransaksi[]
  stok: StokBarang[]
  saranBeli: SaranBeli[]
  /** Utang pelanggan yang masih berjalan. */
  utang: UtangBerjalan[]
  /** Barang yang margin-nya menyusut karena harga modal naik. */
  sinyalMargin: SinyalMargin[]
  /** Margin per barang, untuk layar penjaga margin. */
  margin: MarginBarang[]
  muatData: () => Promise<void>
  simpanTransaksi: (input: SimpanTransaksiInput) => Promise<void>
  /** Simpan penjualan "simpen dulu": sebagian dibayar, sisanya jadi utang. */
  simpanSimpenDulu: (input: SimpenDuluInput) => Promise<void>
  /** Tandai utang lunas. */
  lunasiUtang: (id: string) => Promise<void>
  /** Perbarui harga jual barang (dipakai penjaga margin). */
  ubahHargaJual: (barangId: string, hargaJual: number) => Promise<void>
  resetDemo: () => void
}

const Konteks = createContext<WarungContext | null>(null)

export function useWarung(): WarungContext {
  const nilai = useContext(Konteks)
  if (!nilai) throw new Error("useWarung harus dipakai di dalam PenyediaWarung.")
  return nilai
}

export function PenyediaWarung({ children }: { children: ReactNode }) {
  const [siap, setSiap] = useState(false)
  const [sesi, setSesi] = useState<SesiPengguna | null>(null)
  const [barang, setBarang] = useState<Barang[]>([])
  const [alias, setAlias] = useState<Alias[]>([])
  const [transaksi, setTransaksi] = useState<Transaksi[]>([])
  const [baris, setBaris] = useState<BarisTransaksi[]>([])
  const [utang, setUtang] = useState<UtangBerjalan[]>([])
  const [margin, setMargin] = useState<MarginBarang[]>([])

  // Pemuatan data.
  const muatData = useCallback(async () => {
    if (modeDemoLokal || !supabase) {
      const lokal = bacaLokal()
      setBarang(lokal.barang)
      setAlias(lokal.alias)
      setTransaksi(lokal.transaksi)
      setBaris(lokal.baris)
      return
    }

    const [b, a, t, br, ut, mg] = await Promise.all([
      supabase.from("barang").select("*").order("nama"),
      supabase.from("alias_barang").select("*"),
      ambilSemua<Transaksi>("transaksi", "*", "tanggal", false),
      ambilSemua<BarisTransaksi>("baris_transaksi", "*"),
      supabase.from("utang_berjalan").select("*").order("tanggal", { ascending: false }),
      supabase.from("margin_barang").select("*").order("nama"),
    ])

    if (b.error) throw b.error
    if (a.error) throw a.error
    if (ut.error) throw ut.error
    if (mg.error) throw mg.error

    setBarang((b.data ?? []) as Barang[])
    setAlias((a.data ?? []) as Alias[])
    setTransaksi(t)
    setBaris(br)
    setUtang((ut.data ?? []) as UtangBerjalan[])
    setMargin((mg.data ?? []) as MarginBarang[])
  }, [])

  // Sesi: Supabase Auth, atau akun lokal sederhana.
  useEffect(() => {
    let dibatalkan = false

    async function mulai() {
      if (modeDemoLokal || !supabase) {
        const tersimpan = bacaLokal()
        setBarang(tersimpan.barang)
        setAlias(tersimpan.alias)
        setTransaksi(tersimpan.transaksi)
        setBaris(tersimpan.baris)
        const akun = bacaAkunLokal()
        if (akun) {
          const override = bacaOverrideAkun()
          setSesi({
            ...akun,
            warung: override.warung || akun.warung,
            pemilik: override.pemilik || akun.pemilik,
          })
        }
        setSiap(true)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (dibatalkan) return
      if (data.session?.user) {
        setSesi(await profilDariUser(data.session.user.id))
        await muatData()
      }
      setSiap(true)
    }

    void mulai()
    return () => {
      dibatalkan = true
    }
  }, [muatData])

  const masuk = useCallback(
    async (email: string, sandi: string) => {
      if (modeDemoLokal || !supabase) {
        const override = bacaOverrideAkun()
        const akun: SesiPengguna = {
          userId: "lokal",
          email,
          warung: override.warung || "Warung Sumber Rejeki",
          pemilik: override.pemilik || "Pak Andi",
        }
        simpanAkunLokal(akun)
        setSesi(akun)
        await muatData()
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: sandi,
      })
      if (error) throw error
      if (!data.user) throw new Error("Akun tidak ditemukan.")
      setSesi(await profilDariUser(data.user.id))
      await muatData()
    },
    [muatData],
  )

  const keluar = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    hapusAkunLokal()
    setSesi(null)
  }, [])

  const simpanTransaksi = useCallback(
    async (input: SimpanTransaksiInput) => {
      if (!sesi) throw new Error("Belum masuk.")

      const total = round2(
        input.baris.reduce((sum, b) => sum + b.jumlah * b.hargaSatuan, 0),
      )

      if (modeDemoLokal || !supabase) {
        const id = `trx-${Date.now()}`
        const transaksiBaru: Transaksi = {
          id,
          owner_id: sesi.userId,
          tipe: input.tipe,
          tanggal: new Date().toISOString(),
          sumber: input.sumber,
          teks_mentah: input.teksMentah ?? null,
          total,
          agen: input.agen ?? null,
        }
        const barisBaru: BarisTransaksi[] = input.baris.map((b, index) => ({
          id: `${id}-${index}`,
          transaksi_id: id,
          barang_id: b.barangId,
          jumlah: b.jumlah,
          satuan: b.satuan as BarisTransaksi["satuan"],
          harga_satuan: b.hargaSatuan,
        }))
        const lokal = bacaLokal()
        simpanLokal({
          barang: lokal.barang,
          alias: lokal.alias,
          transaksi: [transaksiBaru, ...lokal.transaksi],
          baris: [...barisBaru, ...lokal.baris],
        })
        setTransaksi((prev) => [transaksiBaru, ...prev])
        setBaris((prev) => [...barisBaru, ...prev])
        return
      }

      const { data: transaksiBaru, error: errorTransaksi } = await supabase
        .from("transaksi")
        .insert({
          owner_id: sesi.userId,
          tipe: input.tipe,
          tanggal: new Date().toISOString(),
          sumber: input.sumber,
          teks_mentah: input.teksMentah ?? null,
          total,
          agen: input.agen ?? null,
        })
        .select()
        .single()

      if (errorTransaksi) throw errorTransaksi

      const barisBaru = input.baris.map((b) => ({
        owner_id: sesi.userId,
        transaksi_id: transaksiBaru.id,
        barang_id: b.barangId,
        jumlah: b.jumlah,
        satuan: b.satuan,
        harga_satuan: b.hargaSatuan,
      }))

      const { error: errorBaris } = await supabase.from("baris_transaksi").insert(barisBaru)
      if (errorBaris) throw errorBaris

      await muatData()
    },
    [sesi, muatData],
  )

  /**
   * Simpan penjualan "simpen dulu".
   *
   * Barang keluar seluruhnya (stok turun untuk semua), tapi hanya sebagian
   * yang dibayar. Sisanya dicatat sebagai utang pelanggan.
   */
  const simpanSimpenDulu = useCallback(
    async (input: SimpenDuluInput) => {
      if (!sesi) throw new Error("Belum masuk.")

      const total = round2(input.baris.reduce((sum, b) => sum + b.jumlah * b.hargaSatuan, 0))
      const dibayar = round2(Math.min(Math.max(input.dibayar, 0), total))
      const sisaUtang = round2(total - dibayar)

      if (modeDemoLokal || !supabase) {
        const id = `trx-${Date.now()}`
        const transaksiBaru: Transaksi = {
          id,
          owner_id: sesi.userId,
          tipe: "jual",
          tanggal: new Date().toISOString(),
          sumber: input.sumber,
          teks_mentah: input.teksMentah ?? null,
          total,
          agen: null,
        }
        const barisBaru: BarisTransaksi[] = input.baris.map((b, index) => ({
          id: `${id}-${index}`,
          transaksi_id: id,
          barang_id: b.barangId,
          jumlah: b.jumlah,
          satuan: b.satuan as BarisTransaksi["satuan"],
          harga_satuan: b.hargaSatuan,
        }))
        const lokal = bacaLokal()
        simpanLokal({
          barang: lokal.barang,
          alias: lokal.alias,
          transaksi: [transaksiBaru, ...lokal.transaksi],
          baris: [...barisBaru, ...lokal.baris],
        })
        setTransaksi((prev) => [transaksiBaru, ...prev])
        setBaris((prev) => [...barisBaru, ...prev])
        return
      }

      const { data: transaksiBaru, error: errorTransaksi } = await supabase
        .from("transaksi")
        .insert({
          owner_id: sesi.userId,
          tipe: "jual",
          tanggal: new Date().toISOString(),
          sumber: input.sumber,
          teks_mentah: input.teksMentah ?? null,
          total,
        })
        .select()
        .single()
      if (errorTransaksi) throw errorTransaksi

      const { error: errorBaris } = await supabase.from("baris_transaksi").insert(
        input.baris.map((b) => ({
          owner_id: sesi.userId,
          transaksi_id: transaksiBaru.id,
          barang_id: b.barangId,
          jumlah: b.jumlah,
          satuan: b.satuan,
          harga_satuan: b.hargaSatuan,
        })),
      )
      if (errorBaris) throw errorBaris

      // Sisa yang tidak dibayar dicatat sebagai utang per barang.
      if (sisaUtang > 0) {
        const bagi = bagiPembayaran(
          input.baris.map((b) => ({
            barangId: b.barangId,
            qty: b.jumlah,
            satuan: b.satuan,
            hargaSatuan: b.hargaSatuan,
          })),
          dibayar,
        )
        const rowsUtang = bagi.perBaris
          .filter((row) => row.utang > 0)
          .map((row) => {
            const asal = input.baris.find((b) => b.barangId === row.barangId)
            return {
              owner_id: sesi.userId,
              pelanggan: input.pelanggan.trim() || "Tanpa nama",
              barang_id: row.barangId,
              qty: asal?.jumlah ?? 0,
              satuan: asal?.satuan ?? "pcs",
              harga_satuan: asal?.hargaSatuan ?? 0,
              total: row.utang,
              status: "belum_lunas",
              dibayar: 0,
            }
          })
        if (rowsUtang.length > 0) {
          const { error: errorUtang } = await supabase.from("utang").insert(rowsUtang)
          if (errorUtang) throw errorUtang
        }
      }

      await muatData()
    },
    [sesi, muatData],
  )

  /** Tandai satu baris utang lunas. */
  const lunasiUtang = useCallback(
    async (id: string) => {
      if (!sesi) throw new Error("Belum masuk.")
      if (modeDemoLokal || !supabase) {
        setUtang((prev) => prev.filter((item) => item.id !== id))
        return
      }
      const { error } = await supabase
        .from("utang")
        .update({ status: "lunas", lunas_pada: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
      await muatData()
    },
    [sesi, muatData],
  )

  /** Ubah harga jual barang. Dipakai penjaga margin. */
  const ubahHargaJual = useCallback(
    async (barangId: string, hargaJual: number) => {
      if (!sesi) throw new Error("Belum masuk.")
      const harga = round2(hargaJual)
      if (harga <= 0) throw new Error("Harga jual harus lebih dari nol.")
      if (modeDemoLokal || !supabase) {
        setMargin((prev) =>
          prev.map((item) =>
            item.barang_id === barangId
              ? {
                  ...item,
                  harga_jual: harga,
                  margin_persen:
                    harga > 0 ? round2(((harga - item.harga_modal) / harga) * 100) : 0,
                }
              : item,
          ),
        )
        return
      }
      const { error } = await supabase
        .from("barang")
        .update({ harga_jual: harga })
        .eq("id", barangId)
      if (error) throw error
      await muatData()
    },
    [sesi, muatData],
  )

  const resetDemo = useCallback(() => {
    const lokal = bacaLokal()
    simpanLokal({ barang: lokal.barang, alias: lokal.alias, transaksi: [], baris: [] })
    setTransaksi([])
    setBaris([])
  }, [])

  // Stok dihitung dari history, bukan disimpan terpisah.
  const stok = useMemo<StokBarang[]>(() => {
    const tipeById = new Map(transaksi.map((t) => [t.id, t.tipe]))
    return barang.map((b) => ({
      barang_id: b.id,
      owner_id: b.owner_id,
      nama: b.nama,
      satuan: b.satuan,
      min_stok: b.min_stok,
      harga_modal: b.harga_modal,
      harga_jual: b.harga_jual,
      lead_time_hari: b.lead_time_hari,
      stok_awal: b.stok_awal,
      stok: hitungStok(
        b.stok_awal,
        baris.filter((row) => row.barang_id === b.id),
        tipeById,
      ),
    }))
  }, [barang, baris, transaksi])

  const saranBeli = useMemo(
    () => hitungSaranBeli(stok, baris, transaksi, new Date()),
    [stok, baris, transaksi],
  )

  const sinyalMargin = useMemo(() => cariSinyalMargin(margin), [margin])

  const nilai = useMemo<WarungContext>(
    () => ({
      siap,
      modeLokal: modeDemoLokal,
      sesi,
      masuk,
      keluar,
      barang,
      alias,
      transaksi,
      baris,
      stok,
      saranBeli,
      utang,
      sinyalMargin,
      margin,
      muatData,
      simpanTransaksi,
      simpanSimpenDulu,
      lunasiUtang,
      ubahHargaJual,
      resetDemo,
    }),
    [
      siap,
      sesi,
      masuk,
      keluar,
      barang,
      alias,
      transaksi,
      baris,
      stok,
      saranBeli,
      utang,
      sinyalMargin,
      margin,
      muatData,
      simpanTransaksi,
      simpanSimpenDulu,
      lunasiUtang,
      ubahHargaJual,
      resetDemo,
    ],
  )

  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>
}


/**
 * Ambil semua baris sebuah tabel, sedikit demi sedikit.
 *
 * PostgREST memotong jawaban di 1000 baris. Kalau tabel lebih besar,
 * baris yang terpotong hilang tanpa tanda — stok jadi negatif, laba kotor
 * salah, dan pelanggan kehilangan barang favorit. Jadi ambil bertahap
 * sampai habis.
 */

/* -------------------------------------------------------------------------- */
/* Mode lokal                                                                 */
/* -------------------------------------------------------------------------- */

interface DataLokal {
  barang: Barang[]
  alias: Alias[]
  transaksi: Transaksi[]
  baris: BarisTransaksi[]
}

function bacaLokal(): DataLokal {
  if (typeof localStorage === "undefined") {
    return { barang: [], alias: [], transaksi: [], baris: [] }
  }
  try {
    const mentah = localStorage.getItem(KUNCI_LOCAL)
    if (!mentah) return { barang: [], alias: [], transaksi: [], baris: [] }
    const data = JSON.parse(mentah) as Partial<DataLokal>
    return {
      barang: data.barang ?? [],
      alias: data.alias ?? [],
      transaksi: data.transaksi ?? [],
      baris: data.baris ?? [],
    }
  } catch {
    return { barang: [], alias: [], transaksi: [], baris: [] }
  }
}

function simpanLokal(data: DataLokal) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(KUNCI_LOCAL, JSON.stringify(data))
}

function bacaAkunLokal(): SesiPengguna | null {
  if (typeof localStorage === "undefined") return null
  try {
    const mentah = localStorage.getItem(`${KUNCI_LOCAL}-akun`)
    return mentah ? (JSON.parse(mentah) as SesiPengguna) : null
  } catch {
    return null
  }
}

function simpanAkunLokal(akun: SesiPengguna) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(`${KUNCI_LOCAL}-akun`, JSON.stringify(akun))
}

function hapusAkunLokal() {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(`${KUNCI_LOCAL}-akun`)
}

/* -------------------------------------------------------------------------- */
/* Profil                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Ambil nama warung dan pemilik dari metadata user. Kalau belum diisi,
 * pakai nilai bawaan supaya demo tidak terasa kosong.
 */
async function profilDariUser(userId: string): Promise<SesiPengguna> {
  if (!supabase) {
    return { ...profilLokal(), userId, email: "" }
  }
  const { data } = await supabase.auth.getUser()
  const meta = data.user?.user_metadata ?? {}
  const dasar = {
    warung: typeof meta.warung === "string" ? meta.warung : "Warung Sumber Rejeki",
    pemilik: typeof meta.pemilik === "string" ? meta.pemilik : "Pak Andi",
  }
  // Nama yang diubah di Pengaturan menang, supaya tidak perlu tulis ulang
  // metadata akun Supabase.
  const override = bacaOverrideAkun()
  return {
    userId,
    email: data.user?.email ?? "",
    warung: override.warung || dasar.warung,
    pemilik: override.pemilik || dasar.pemilik,
  }
}

function profilLokal(): { warung: string; pemilik: string } {
  return { warung: "Warung Sumber Rejeki", pemilik: "Pak Andi" }
}

/** Nama warung/pemilik yang diubah dari halaman Pengaturan. */
export function bacaOverrideAkun(): { warung: string; pemilik: string } {
  try {
    const mentah = window.localStorage.getItem("warung-pintar-akun")
    if (!mentah) return { warung: "", pemilik: "" }
    const data = JSON.parse(mentah) as { warung?: string; pemilik?: string }
    return { warung: data.warung ?? "", pemilik: data.pemilik ?? "" }
  } catch {
    return { warung: "", pemilik: "" }
  }
}
