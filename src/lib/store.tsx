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
import { hitungStok, hitungSaranBeli, round2 } from "./inventory"
import type {
  Alias,
  BarisTransaksi,
  Barang,
  SaranBeli,
  StokBarang,
  Transaksi,
} from "./types"

const KUNCI_LOCAL = "warung-pintar-hackathon-v1"

export interface SesiPengguna {
  userId: string
  email: string
  warung: string
  pemilik: string
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
  muatData: () => Promise<void>
  simpanTransaksi: (input: SimpanTransaksiInput) => Promise<void>
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

    const [b, a, t, br] = await Promise.all([
      supabase.from("barang").select("*").order("nama"),
      supabase.from("alias_barang").select("*"),
      supabase.from("transaksi").select("*").order("tanggal", { ascending: false }),
      supabase.from("baris_transaksi").select("*"),
    ])

    if (b.error) throw b.error
    if (a.error) throw a.error
    if (t.error) throw t.error
    if (br.error) throw br.error

    setBarang((b.data ?? []) as Barang[])
    setAlias((a.data ?? []) as Alias[])
    setTransaksi((t.data ?? []) as Transaksi[])
    setBaris((br.data ?? []) as BarisTransaksi[])
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
        if (akun) setSesi(akun)
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
        const akun: SesiPengguna = {
          userId: "lokal",
          email,
          warung: "Warung Sumber Rejeki",
          pemilik: "Pak Andi",
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
      muatData,
      simpanTransaksi,
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
      muatData,
      simpanTransaksi,
      resetDemo,
    ],
  )

  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>
}

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
    return { userId, email: "", warung: "Warung Sumber Rejeki", pemilik: "Pak Andi" }
  }
  const { data } = await supabase.auth.getUser()
  const meta = data.user?.user_metadata ?? {}
  return {
    userId,
    email: data.user?.email ?? "",
    warung: typeof meta.warung === "string" ? meta.warung : "Warung Sumber Rejeki",
    pemilik: typeof meta.pemilik === "string" ? meta.pemilik : "Pak Andi",
  }
}
