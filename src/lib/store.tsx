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
import { dataDemoLokal, type DataWarungLokal } from "./dataDemo"
import type { DataPelanggan } from "./pelanggan"
import type {
  Alias,
  BarisTransaksi,
  Barang,
  MarginBarang,
  SaranBeli,
  Satuan,
  StokBarang,
  Titip,
  Transaksi,
  Utang,
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

/** Data barang titipan baru. */
export interface SimpanTitipInput {
  /** Nama yang menitipkan barang, mis. "Pak Hendra". */
  pemilik: string
  namaBarang: string
  satuan: Satuan
  /** Berapa yang dititipkan. */
  qty: number
  /** Harga dari pemilik barang. */
  hargaPemilik: number
  /** Harga jual ke pelanggan. */
  hargaJual: number
  /** Komisi warung dalam persen. */
  komisiPersen: number
  catatan?: string | null
}

/** Barang baru untuk katalog warung. */
export interface SimpanBarangInput {
  /** Nama baku barang, mis. "Gula Pasir". */
  nama: string
  satuan: Satuan
  /** Berapa yang tersedia saat barang dimasukkan ke katalog. */
  stokAwal: number
  /** Batas stok minimum sebelum perlu dibeli. */
  minStok: number
  /** Harga beli dari pemasok. */
  hargaModal: number
  /** Harga jual ke pelanggan. */
  hargaJual: number
  /** Lama barang datang dari pemasok, dalam hari. */
  leadTimeHari: number
  /** Cara orang lain menyebut barang ini, mis. "gulpas". */
  alias?: string[]
}

/** Pembelian manual: barang masuk ke gudang. */
export interface CatatPembelianInput {
  barangId: string
  jumlah: number
  /** Harga beli per satuan. */
  hargaSatuan: number
  /** Nama pemasok, opsional. */
  agen?: string
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
  /** Buku pelanggan: nama panggilan, nomor telepon opsional. */
  pelanggan: DataPelanggan[]
  /** Barang yang margin-nya menyusut karena harga modal naik. */
  sinyalMargin: SinyalMargin[]
  /** Margin per barang, untuk layar penjaga margin. */
  margin: MarginBarang[]
  /** Barang titipan (konsinyasi) milik orang lain. */
  titip: Titip[]
  muatData: () => Promise<void>
  simpanTransaksi: (input: SimpanTransaksiInput) => Promise<void>
  /** Simpan penjualan "simpen dulu": sebagian dibayar, sisanya jadi utang. */
  simpanSimpenDulu: (input: SimpenDuluInput) => Promise<void>
  /** Tandai utang lunas. */
  lunasiUtang: (id: string) => Promise<void>
  /** Perbarui harga jual barang (dipakai penjaga margin). */
  ubahHargaJual: (barangId: string, hargaJual: number) => Promise<void>
  /** Simpan pelanggan baru ke buku pelanggan. */
  simpanPelanggan: (input: { nama: string; telepon?: string; catatan?: string }) => Promise<void>
  /** Catat barang titipan baru. */
  simpanTitip: (input: SimpanTitipInput) => Promise<void>
  /** Tambah barang baru ke katalog. */
  simpanBarang: (input: SimpanBarangInput) => Promise<void>
  /** Catat pembelian: barang masuk ke gudang. */
  catatPembelian: (input: CatatPembelianInput) => Promise<void>
  /** Catat penjualan barang titipan sebanyak qty. */
  catatTitipTerjual: (id: string, qty: number) => Promise<void>
  /** Tutup titipan: barang dikembalikan, bagian pemilik dibayar. */
  tutupTitip: (id: string) => Promise<void>
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
  const [pelanggan, setPelanggan] = useState<DataPelanggan[]>([])
  const [margin, setMargin] = useState<MarginBarang[]>([])
  const [titip, setTitip] = useState<Titip[]>([])

  // Pemuatan data.
  const muatData = useCallback(async () => {
    if (modeDemoLokal || !supabase) {
      const lokal = bacaLokal()
      setBarang(lokal.barang)
      setAlias(lokal.alias)
      setTransaksi(lokal.transaksi)
      setBaris(lokal.baris)
      const namaBarang = new Map(lokal.barang.map((b) => [b.id, b.nama]))
      setPelanggan(
        lokal.pelanggan.map((p) => ({ ...p, owner_id: sesi?.userId ?? "lokal" })),
      )
      setUtang(
        lokal.utang.map((u) => ({
          ...u,
          nama_barang: namaBarang.get(u.barang_id) ?? "",
          sisa: Math.max(u.total - u.dibayar, 0),
        })),
      )
      setTitip(lokal.titip)
      // Margin di mode lokal dihitung dari harga modal barang, karena tidak
      // ada riwayat harga modal. Tanpa ini, halaman penjaga margin kosong
      // total dan tidak bisa dicoba.
      setMargin(
        lokal.barang.map((b) => ({
          barang_id: b.id,
          owner_id: b.owner_id,
          nama: b.nama,
          satuan: b.satuan,
          harga_jual: b.harga_jual,
          harga_modal: b.harga_modal,
          modal_sebelumnya: b.harga_modal,
          margin_persen:
            b.harga_jual > 0
              ? round2(((b.harga_jual - b.harga_modal) / b.harga_jual) * 100)
              : 0,
        })),
      )
      return
    }

    const [b, a, t, br, ut, mg, tp, pl] = await Promise.all([
      supabase.from("barang").select("*").order("nama"),
      supabase.from("alias_barang").select("*"),
      ambilSemua<Transaksi>("transaksi", "*", "tanggal", false),
      ambilSemua<BarisTransaksi>("baris_transaksi", "*"),
      supabase.from("utang_berjalan").select("*").order("tanggal", { ascending: false }),
      supabase.from("margin_barang").select("*").order("nama"),
      supabase.from("titip").select("*").order("dibuat_pada", { ascending: false }),
      supabase.from("pelanggan").select("*").order("nama"),
    ])

    if (b.error) throw b.error
    if (a.error) throw a.error
    if (ut.error) throw ut.error
    if (mg.error) throw mg.error
    if (tp.error) throw tp.error
    if (pl.error) throw pl.error

    setBarang((b.data ?? []) as Barang[])
    setAlias((a.data ?? []) as Alias[])
    setTransaksi(t)
    setBaris(br)
    setUtang((ut.data ?? []) as UtangBerjalan[])
    setMargin((mg.data ?? []) as MarginBarang[])
    setTitip((tp.data ?? []) as Titip[])
    setPelanggan((pl.data ?? []) as DataPelanggan[])
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

      // Setiap baris harus menunjuk barang yang benar-benar ada. Kalau id-nya
      // kosong, database menolaknya dan seluruh transaksi gagal — dengan pesan
      // error bahasa Inggris yang tidak ada artinya buat pemilik warung.
      const idValid = new Set(barang.map((b) => b.id))
      const barisTanpaId = input.baris.find((b) => !idValid.has(b.barangId))
      if (barisTanpaId) {
        throw new Error(
          "Ada barang yang belum ada di katalog. Tambahkan barangnya dulu, lalu catat lagi.",
        )
      }

      // Penyesuaian tidak punya nilai jual, jadi totalsnya 0. Kalau dihitung
      // dari baris, selisih negatif membuat total negatif — dan database
      // menolak transaksi dengan total di bawah nol.
      const total =
        input.tipe === "sesuaikan"
          ? 0
          : round2(input.baris.reduce((sum, b) => sum + b.jumlah * b.hargaSatuan, 0))

      if (modeDemoLokal || !supabase) {
        const id = idLokal("trx")
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
          ...lokal,
          transaksi: [transaksiBaru, ...lokal.transaksi],
          baris: [...barisBaru, ...lokal.baris],
        })
        if (input.tipe === "beli") {
          await catatPerubahanHargaModal(input.baris, barang, sesi.userId, true)
        }
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

      // Pembelian: remember harga modal lama kalau harga belinya berubah.
      if (input.tipe === "beli") {
        await catatPerubahanHargaModal(input.baris, barang, sesi.userId, false)
      }

      await muatData()
    },
    [sesi, barang, muatData],
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
        const id = idLokal("trx")
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

        // Utangnya ikut dicatat di mode lokal. Kalau tidak, penjualan
        // "simpen dulu" jadi hilang utangnya: barang keluar, uang tidak
        // masuk, dan buku utang selalu kosong.
        const rowsUtangLokal = hitungBarisUtang(input, dibayar, sesi.userId).map(
          (u, index) => ({ ...u, id: idLokal(`utang-${index}`) }),
        )

        const lokal = bacaLokal()
        simpanLokal({
          ...lokal,
          transaksi: [transaksiBaru, ...lokal.transaksi],
          baris: [...barisBaru, ...lokal.baris],
          utang: [...rowsUtangLokal, ...lokal.utang],
        })
        setTransaksi((prev) => [transaksiBaru, ...prev])
        setBaris((prev) => [...barisBaru, ...prev])
        const namaBarang = new Map(lokal.barang.map((b) => [b.id, b.nama]))
        setUtang((prev) => [
          ...rowsUtangLokal.map((u) => ({
            ...u,
            nama_barang: namaBarang.get(u.barang_id) ?? "",
            sisa: Math.max(u.total - u.dibayar, 0),
          })),
          ...prev,
        ])
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
        const rowsUtang = hitungBarisUtang(input, dibayar, sesi.userId)
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
        const lokal = bacaLokal()
        const sisa = lokal.utang.filter((item) => item.id !== id)
        simpanLokal({ ...lokal, utang: sisa })
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

  /**
   * Simpan pelanggan baru ke buku pelanggan.
   *
   * Nama panggilan jadi identitas. Nomor telepon dan catatan opsional —
   * banyak pelanggan warung cuma punya nama.
   */
  const simpanPelanggan = useCallback(
    async (input: { nama: string; telepon?: string; catatan?: string }) => {
      if (!sesi) throw new Error("Belum masuk.")
      const nama = input.nama.trim().replace(/\s+/g, " ")
      if (!nama) throw new Error("Nama panggilan pelanggan belum diisi.")

      const sudahAda = pelanggan.find(
        (p) => p.nama.toLowerCase() === nama.toLowerCase(),
      )
      if (sudahAda) throw new Error(`Sudah ada pelanggan bernama "${nama}".`)

      if (modeDemoLokal || !supabase) {
        const baru: DataPelanggan = {
          id: idLokal("plg"),
          owner_id: sesi.userId,
          nama,
          telepon: input.telepon?.trim() || null,
          catatan: input.catatan?.trim() || null,
        }
        const lokal = bacaLokal()
        simpanLokal({ ...lokal, pelanggan: [...lokal.pelanggan, baru] })
        setPelanggan((prev) => [...prev, baru])
        return
      }

      const { error } = await supabase.from("pelanggan").insert({
        owner_id: sesi.userId,
        nama,
        telepon: input.telepon?.trim() || null,
        catatan: input.catatan?.trim() || null,
      })
      if (error) {
        if (error.code === "23505") {
          throw new Error(`Sudah ada pelanggan bernama "${nama}".`)
        }
        throw error
      }
      await muatData()
    },
    [sesi, pelanggan, muatData],
  )

  /**
   * Catat barang titipan baru.
   *
   * Barang titipan bukan milik warung, jadi tidak menyentuh stok. Yang
   * disimpan cuma datanya: siapa yang menitipkan, berapa, dan komisinya.
   */
  const simpanTitip = useCallback(
    async (input: SimpanTitipInput) => {
      if (!sesi) throw new Error("Belum masuk.")
      const pemilik = input.pemilik.trim()
      const namaBarang = input.namaBarang.trim()
      if (!pemilik) throw new Error("Nama pemilik barang wajib diisi.")
      if (!namaBarang) throw new Error("Nama barang titipan wajib diisi.")
      if (!(input.qty > 0)) throw new Error("Jumlah titipan harus lebih dari nol.")
      if (!Number.isFinite(input.komisiPersen) || input.komisiPersen < 0) {
        throw new Error("Komisi warung tidak boleh negatif.")
      }
      // Di atas 100% berarti bagian pemilik barang jadi minus — tolak.
      if (input.komisiPersen > 100) {
        throw new Error("Komisi warung tidak boleh lebih dari 100%.")
      }

      if (modeDemoLokal || !supabase) {
        const baru: Titip = {
          id: idLokal("titip"),
          owner_id: sesi.userId,
          pemilik,
          nama_barang: namaBarang,
          satuan: input.satuan || "pcs",
          qty: input.qty,
          terjual: 0,
          harga_pemilik: input.hargaPemilik,
          harga_jual: input.hargaJual,
          komisi_persen: input.komisiPersen,
          status: "aktif",
          catatan: input.catatan?.trim() || null,
          dibuat_pada: new Date().toISOString(),
          selesai_pada: null,
        }
        const lokal = bacaLokal()
        simpanLokal({ ...lokal, titip: [baru, ...lokal.titip] })
        setTitip((prev) => [baru, ...prev])
        return
      }

      const { error } = await supabase.from("titip").insert({
        owner_id: sesi.userId,
        pemilik,
        nama_barang: namaBarang,
        satuan: input.satuan || "pcs",
        qty: input.qty,
        terjual: 0,
        harga_pemilik: input.hargaPemilik,
        harga_jual: input.hargaJual,
        komisi_persen: input.komisiPersen,
        status: "aktif",
        catatan: input.catatan?.trim() || null,
      })
      if (error) throw error
      await muatData()
    },
    [sesi, muatData],
  )

  /**
   * Tambah barang baru ke katalog.
   *
   * Satu barang = satu nama baku. Kalau nama sudah dipakai, database
   * menolak (unik per pemilik) — pesannya diterjemahkan supaya pemilik
   * tahu harus menambah alias, bukan membuat barang baru.
   */
  const simpanBarang = useCallback(
    async (input: SimpanBarangInput) => {
      if (!sesi) throw new Error("Belum masuk.")
      const nama = input.nama.trim().replace(/\s+/g, " ")
      if (!nama) throw new Error("Nama barang wajib diisi.")
      if (input.hargaJual <= 0) throw new Error("Harga jual harus lebih dari nol.")
      if (input.hargaModal < 0) throw new Error("Harga modal tidak boleh negatif.")
      if (input.stokAwal < 0 || input.minStok < 0) {
        throw new Error("Jumlah barang tidak boleh negatif.")
      }

      const aliasBaru = (input.alias ?? [])
        .map((a) => a.trim().replace(/\s+/g, " "))
        .filter((a) => a.length > 0 && a.toLowerCase() !== nama.toLowerCase())

      // Cek nama yang sama sebelum menyentuh database. Database memang menolak
      // (unik per pemilik), tapi errornya bahasa Inggris dan muncul sebagai
      // 409 di konsol — terlihat seperti aplikasi rusak.
      const sudahAda = barang.find((b) => b.nama.toLowerCase() === nama.toLowerCase())
      if (sudahAda) {
        throw new Error(`Sudah ada barang bernama "${nama}".`)
      }

      if (modeDemoLokal || !supabase) {
        const id = idLokal("barang")
        const baru: Barang = {
          id,
          owner_id: sesi.userId,
          nama,
          satuan: input.satuan,
          stok_awal: input.stokAwal,
          min_stok: input.minStok,
          harga_modal: input.hargaModal,
          harga_jual: input.hargaJual,
          lead_time_hari: input.leadTimeHari,
        }
        const aliasBaruRows: Alias[] = aliasBaru.map((a, index) => ({
          id: `${id}-alias-${index}`,
          owner_id: sesi.userId,
          barang_id: id,
          alias: a,
        }))
        const lokal = bacaLokal()
        simpanLokal({
          ...lokal,
          barang: [...lokal.barang, baru],
          alias: [...lokal.alias, ...aliasBaruRows],
        })
        setBarang((prev) => [...prev, baru])
        setAlias((prev) => [...prev, ...aliasBaruRows])
        return
      }

      const { data, error } = await supabase
        .from("barang")
        .insert({
          owner_id: sesi.userId,
          nama,
          satuan: input.satuan,
          stok_awal: input.stokAwal,
          min_stok: input.minStok,
          harga_modal: input.hargaModal,
          harga_jual: input.hargaJual,
          lead_time_hari: input.leadTimeHari,
        })
        .select()
        .single()
      if (error) {
        if (error.code === "23505") {
          throw new Error(`Sudah ada barang bernama "${nama}".`)
        }
        throw error
      }

      if (aliasBaru.length > 0) {
        const { error: errorAlias } = await supabase.from("alias_barang").insert(
          aliasBaru.map((a) => ({
            owner_id: sesi.userId,
            barang_id: data.id,
            alias: a,
          })),
        )
        if (errorAlias) throw errorAlias
      }

      await muatData()
    },
    [sesi, barang, muatData],
  )

  /**
   * Catat pembelian: barang masuk ke gudang.
   *
   * Dua hal terjadi sekaligus:
   *  1. Transaksi pembelian tercatat, jadi stok naik dari history.
   *  2. Harga modal lama disimpan sebagai riwayat, lalu harga modal barang
   *     diupdate ke harga beli yang baru. Tanpa ini, Penjaga Margin tidak
   *     pernah tahu harga modal naik — fitur itu diam-diam tidak jalan.
   */
  const catatPembelian = useCallback(
    async (input: CatatPembelianInput) => {
      if (!sesi) throw new Error("Belum masuk.")
      const row = barang.find((b) => b.id === input.barangId)
      if (!row) throw new Error("Barang tidak ditemukan.")
      if (!(input.jumlah > 0)) throw new Error("Jumlah pembelian harus lebih dari nol.")
      if (input.hargaSatuan < 0) throw new Error("Harga beli tidak boleh negatif.")

      await simpanTransaksi({
        tipe: "beli",
        sumber: "manual",
        agen: input.agen?.trim() || undefined,
        baris: [
          {
            barangId: row.id,
            jumlah: input.jumlah,
            satuan: row.satuan,
            hargaSatuan: input.hargaSatuan,
          },
        ],
      })

      // Perubahan harga modal dicatat di dalam simpanTransaksi, jadi pembelian
      // manual dan hasil pindai nota diperlakukan sama.
    },
    [sesi, barang, simpanTransaksi],
  )

  /** Catat penjualan barang titipan sebanyak `qty`. */
  const catatTitipTerjual = useCallback(
    async (id: string, qty: number) => {
      if (!sesi) throw new Error("Belum masuk.")
      const row = titip.find((item) => item.id === id)
      if (!row) throw new Error("Titipan tidak ditemukan.")
      const terjual = Math.min(Math.max(0, qty), Math.max(0, row.qty - row.terjual))
      if (terjual <= 0) throw new Error("Tidak ada barang titipan yang bisa dijual.")

      if (modeDemoLokal || !supabase) {
        const lokal = bacaLokal()
        simpanLokal({
          ...lokal,
          titip: lokal.titip.map((item) =>
            item.id === id ? { ...item, terjual: item.terjual + terjual } : item,
          ),
        })
        setTitip((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, terjual: item.terjual + terjual } : item,
          ),
        )
        return
      }

      const { error } = await supabase
        .from("titip")
        .update({ terjual: row.terjual + terjual })
        .eq("id", id)
      if (error) throw error
      await muatData()
    },
    [sesi, titip, muatData],
  )

  /**
   * Tutup titipan.
   *
   * Sisa barang dikembalikan ke pemilik barang, jadi statusnya selesai dan
   * tidak lagi masuk hitungan yang harus dibayar.
   */
  const tutupTitip = useCallback(
    async (id: string) => {
      if (!sesi) throw new Error("Belum masuk.")
      if (modeDemoLokal || !supabase) {
        const lokal = bacaLokal()
        simpanLokal({
          ...lokal,
          titip: lokal.titip.map((item) =>
            item.id === id
              ? { ...item, status: "selesai" as const, selesai_pada: new Date().toISOString() }
              : item,
          ),
        })
        setTitip((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, status: "selesai", selesai_pada: new Date().toISOString() }
              : item,
          ),
        )
        return
      }
      const { error } = await supabase
        .from("titip")
        .update({ status: "selesai", selesai_pada: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
      await muatData()
    },
    [sesi, muatData],
  )

  /**
   * Kembalikan data mode lokal ke kondisi semula.
   *
   * Bukan sekadar menghapus transaksi: kalau cuma dihapus, warung jadi
   * kosong dan tidak ada cara mengisinya lagi tanpa internet.
   */
  const resetDemo = useCallback(() => {
    const demo = dataDemoLokal()
    simpanLokal(demo)
    setBarang(demo.barang)
    setAlias(demo.alias)
    setTransaksi(demo.transaksi)
    setBaris(demo.baris)
    setUtang(
      demo.utang.map((u) => ({
        ...u,
        nama_barang: demo.barang.find((b) => b.id === u.barang_id)?.nama ?? "",
        sisa: Math.max(u.total - u.dibayar, 0),
      })),
    )
    setTitip(demo.titip)
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
      pelanggan,
      sinyalMargin,
      margin,
      titip,
      muatData,
      simpanTransaksi,
      simpanSimpenDulu,
      lunasiUtang,
      ubahHargaJual,
      simpanPelanggan,
      simpanTitip,
      simpanBarang,
      catatPembelian,
      catatTitipTerjual,
      tutupTitip,
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
      pelanggan,
      sinyalMargin,
      margin,
      titip,
      muatData,
      simpanTransaksi,
      simpanSimpenDulu,
      lunasiUtang,
      ubahHargaJual,
      simpanPelanggan,
      simpanTitip,
      simpanBarang,
      catatPembelian,
      catatTitipTerjual,
      tutupTitip,
      resetDemo,
    ],
  )

  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>
}



/**
 * Catat perubahan harga modal setelah pembelian.
 *
 * Dua hal terjadi:
 *  1. Harga modal LAMA disimpan sebagai riwayat.
 *  2. Harga modal barang diupdate ke harga beli yang baru.
 *
 * Tanpa ini, Penjaga Margin tidak pernah tahu harga modal naik — fitur itu
 * diam-diam tidak jalan. Dan karena laba kotor memakai harga modal dari
 * katalog, laba kotornya juga ikut salah.
 *
 * Dipanggil dari `simpanTransaksi`, jadi pembelian manual dan hasil pindai
 * nota diperlakukan sama.
 */
async function catatPerubahanHargaModal(
  baris: Array<{ barangId: string; hargaSatuan: number }>,
  barang: Barang[],
  ownerId: string,
  modeLokal: boolean,
): Promise<void> {
  const hargaModalBarang = new Map(barang.map((b) => [b.id, b.harga_modal]))

  for (const row of baris) {
    const hargaLama = hargaModalBarang.get(row.barangId)
    if (hargaLama === undefined) continue
    if (hargaLama <= 0) continue
    if (round2(hargaLama) === round2(row.hargaSatuan)) continue

    if (modeLokal || !supabase) {
      const lokal = bacaLokal()
      simpanLokal({
        ...lokal,
        barang: lokal.barang.map((b) =>
          b.id === row.barangId ? { ...b, harga_modal: round2(row.hargaSatuan) } : b,
        ),
      })
    } else {
      const { error: errorRiwayat } = await supabase.from("harga_modal_riwayat").insert({
        owner_id: ownerId,
        barang_id: row.barangId,
        harga_modal: hargaLama,
        tanggal: new Date().toISOString(),
      })
      if (errorRiwayat) throw errorRiwayat

      const { error: errorBarang } = await supabase
        .from("barang")
        .update({ harga_modal: round2(row.hargaSatuan) })
        .eq("id", row.barangId)
      if (errorBarang) throw errorBarang
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Mode lokal                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Id unik untuk data lokal.
 *
 * `Date.now()` saja bisa bentrok: dua transaksi yang disimpan dalam milidetik
 * yang sama akan mendapat id yang sama, dan baris yang salah ikut berubah.
 */
let penghitungLokal = 0
function idLokal(prefix: string): string {
  penghitungLokal += 1
  return `${prefix}-${Date.now()}-${penghitungLokal}`
}

/**
 * Hitung baris utang dari penjualan "simpen dulu".
 *
 * Satu baris = satu barang yang diutangkan. Barang yang dibayar penuh tidak
 * masuk. Dipakai baik di mode Supabase maupun mode lokal, supaya angkanya
 * sama di keduanya.
 */
function hitungBarisUtang(
  input: SimpenDuluInput,
  dibayar: number,
  ownerId: string,
): Array<Omit<Utang, "id">> {
  const bagi = bagiPembayaran(
    input.baris.map((b) => ({
      barangId: b.barangId,
      qty: b.jumlah,
      satuan: b.satuan,
      hargaSatuan: b.hargaSatuan,
    })),
    dibayar,
  )
  const pelanggan = input.pelanggan.trim() || "Tanpa nama"
  return bagi.perBaris
    .filter((row) => row.utang > 0)
    .map((row) => {
      // Pakai baris asal sesuai posisinya, bukan mencari nama barang pertama.
      // Kalau barang yang sama muncul dua kali, qty dan harganya bisa tertukar.
      const asal = input.baris[row.index]
      // Qty ikut bagian yang belum dibayar, bukan seluruh qty baris.
      // Kalau qty-nya penuh tapi totalnya cuma sebagian, isi baris utang
      // tidak konsisten: qty x harga tidak sama dengan total.
      const hargaBaris = (asal?.jumlah ?? 0) * (asal?.hargaSatuan ?? 0)
      const qtyUtang =
        hargaBaris > 0
          ? round2(((asal?.jumlah ?? 0) * row.utang) / hargaBaris)
          : asal?.jumlah ?? 0
      return {
        owner_id: ownerId,
        pelanggan,
        barang_id: row.barangId,
        qty: qtyUtang,
        satuan: (asal?.satuan ?? "pcs") as Satuan,
        harga_satuan: asal?.hargaSatuan ?? 0,
        total: row.utang,
        tanggal: new Date().toISOString(),
        status: "belum_lunas" as const,
        dibayar: 0,
        lunas_pada: null,
      }
    })
}

interface DataLokal extends DataWarungLokal {}

const KOSONG: DataWarungLokal = {
  barang: [],
  alias: [],
  transaksi: [],
  baris: [],
  utang: [],
  titip: [],
  pelanggan: [],
}

function bacaLokal(): DataLokal {
  if (typeof localStorage === "undefined") return KOSONG
  try {
    const mentah = localStorage.getItem(KUNCI_LOCAL)
    if (!mentah) {
      // Belum ada data: isi dengan data contoh supaya aplikasinya bisa
      // langsung dicoba, bukan terbuka kosong.
      const demo = dataDemoLokal()
      simpanLokal(demo)
      return demo
    }
    const data = JSON.parse(mentah) as Partial<DataLokal>
    return {
      barang: data.barang ?? [],
      alias: data.alias ?? [],
      transaksi: data.transaksi ?? [],
      baris: data.baris ?? [],
      utang: data.utang ?? [],
      titip: data.titip ?? [],
      pelanggan: data.pelanggan ?? [],
    }
  } catch {
    return KOSONG
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
