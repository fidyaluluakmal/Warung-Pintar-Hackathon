import { useCallback, useEffect, useMemo, useState } from "react"
import { Icon } from "../components/Icon"
import { angka, rupiah } from "../lib/format"
import {
  barisPenyesuaian,
  catatHitung,
  hapusHitung,
  hitungOpname,
  mulaiSesiOpname,
  ringkasanOpname,
  type SesiOpname,
} from "../lib/opname"
import { supabase } from "../lib/supabase"
import type { Satuan } from "../lib/types"

/** Baris dari view `stok_barang` yang dipakai halaman ini. */
interface BarisStok {
  barang_id: string
  nama: string
  satuan: string
  stok: number
  harga_modal: number
}

/**
 * Cek Stok (opname) — hitung stok fisik lalu catat selisihnya.
 *
 * Halaman ini berdiri sendiri: ia membaca stok sistem langsung dari view
 * `stok_barang` dan menulis penyesuaian ke `transaksi` + `baris_transaksi`.
 * Jadi tidak bergantung sama sekali pada state toko lain — angka yang
 * tampil di sini sama dengan angka stok di kasir karena sumbernya sama.
 */
export function CekStok() {
  const [sesi, setSesi] = useState<SesiOpname | null>(null)
  const [muat, setMuat] = useState(true)
  const [galat, setGalat] = useState("")
  const [galatSimpan, setGalatSimpan] = useState("")
  const [sukses, setSukses] = useState("")
  const [menyimpan, setMenyimpan] = useState(false)

  const muatStok = useCallback(async () => {
    if (!supabase) {
      setMuat(false)
      return
    }
    setMuat(true)
    setGalat("")
    try {
      const { data, error } = await supabase
        .from("stok_barang")
        .select("barang_id, nama, satuan, stok, harga_modal")
        .order("nama")
      if (error) throw error

      const baris = (data ?? []) as BarisStok[]
      const daftar = baris.map((row) => ({
        barangId: row.barang_id,
        nama: row.nama,
        satuan: row.satuan as Satuan,
        stokSistem: Number(row.stok) || 0,
        hargaModal: Number(row.harga_modal) || 0,
      }))
      setSesi(mulaiSesiOpname(daftar))
    } catch (kesalahan) {
      setSesi(null)
      setGalat(
        kesalahan instanceof Error
          ? `Stok barang belum bisa dimuat: ${kesalahan.message}`
          : "Stok barang belum bisa dimuat. Coba muat ulang sebentar lagi.",
      )
    } finally {
      setMuat(false)
    }
  }, [])

  useEffect(() => {
    void muatStok()
  }, [muatStok])

  const hasil = useMemo(() => (sesi ? hitungOpname(sesi) : []), [sesi])
  const ringkasan = useMemo(() => ringkasanOpname(hasil), [hasil])
  const baris = useMemo(() => barisPenyesuaian(hasil), [hasil])

  function ubahHitung(barangId: string, nilai: string) {
    setSesi((sekarang) => {
      if (!sekarang) return sekarang
      if (nilai.trim() === "") return hapusHitung(sekarang, barangId)
      const angkaBaru = Number(nilai)
      if (!Number.isFinite(angkaBaru)) return sekarang
      return catatHitung(sekarang, barangId, Math.max(0, angkaBaru))
    })
    setGalatSimpan("")
    setSukses("")
  }

  function mulaiUlang() {
    if (!sesi) return
    setSesi(mulaiSesiOpname(sesi.barang))
    setGalatSimpan("")
    setSukses("")
  }

  async function simpan() {
    if (!supabase || !sesi) return
    if (baris.length === 0) {
      setGalatSimpan("Belum ada barang yang beda. Isi jumlah barang di rak dulu, baru simpan.")
      return
    }

    setMenyimpan(true)
    setGalatSimpan("")
    setSukses("")
    try {
      const { data: auth, error: errorAuth } = await supabase.auth.getUser()
      if (errorAuth) throw errorAuth
      const ownerId = auth.user?.id
      if (!ownerId) throw new Error("Belum masuk. Masuk dulu baru bisa menyimpan hasil hitung.")

      // Satu transaksi penyesuaian — semua selisih dicatat dalam satu peristiwa.
      const { data: transaksiBaru, error: errorTransaksi } = await supabase
        .from("transaksi")
        .insert({
          owner_id: ownerId,
          tipe: "sesuaikan",
          tanggal: new Date().toISOString(),
          sumber: "manual",
          total: 0,
        })
        .select("id")
        .single()
      if (errorTransaksi) throw errorTransaksi
      if (!transaksiBaru) throw new Error("Transaksi penyesuaian gagal dibuat.")

      const { error: errorBaris } = await supabase.from("baris_transaksi").insert(
        baris.map((b) => ({
          owner_id: ownerId,
          transaksi_id: transaksiBaru.id,
          barang_id: b.barangId,
          // Bertanda: negatif berarti barang hilang, positif berarti lebih.
          jumlah: b.delta,
          satuan: b.satuan,
          harga_satuan: b.hargaSatuan,
        })),
      )
      if (errorBaris) throw errorBaris

      setSukses(
        `Penyesuaian tersimpan: ${baris.length} barang diubah. Stok di kasir sekarang ikut menyesuaikan.`,
      )
      await muatStok()
    } catch (kesalahan) {
      setGalatSimpan(
        kesalahan instanceof Error
          ? `Penyesuaian belum tersimpan: ${kesalahan.message}`
          : "Penyesuaian belum tersimpan. Coba sekali lagi.",
      )
    } finally {
      setMenyimpan(false)
    }
  }

  const adaSupabase = supabase !== null

  return (
    <div className="space-y-5">
      <div className="page-title">
        <div>
          <span className="date-label">Cek Stok</span>
          <h1>Hitung stok fisik</h1>
          <p>Bandingkan isi rak dengan stok yang tercatat, biar barang yang hilang kelihatan.</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Kenapa warung perlu hitung stok fisik?</h2>
            <p>
              Warung tidak punya pemindai barcode seperti minimarket, jadi stok sering
              meleset tanpa disadari: ada yang telat dicatat, ada yang diambil tanpa
              dibayar, ada juga barang rusak lalu dibuang. Kalau barang hilang sedikit
              demi sedikit, lama-lama warung tumbuh tapi uangnya tidak.
            </p>
          </div>
        </div>
        <p className="form-note">
          Hitung fisik bukan fitur minimarket. Ini cara paling murah buat warung tahu
          barangnya benar-benar ada atau tidak — dan sekarang juga bisa dicatat sendiri.
        </p>
      </section>

      {!adaSupabase && (
        <section className="panel">
          <p className="form-note">
            Cek stok ini butuh koneksi ke database warung. Supabase belum diatur di
            aplikasi ini, jadi hasil hitungan belum bisa disimpan. Isi{" "}
            <strong>VITE_SUPABASE_URL</strong> dan{" "}
            <strong>VITE_SUPABASE_PUBLISHABLE_KEY</strong>, lalu jalankan ulang.
          </p>
        </section>
      )}

      {adaSupabase && muat && (
        <section className="panel">
          <p className="form-note">Memuat stok barang…</p>
        </section>
      )}

      {adaSupabase && !muat && galat && (
        <section className="panel">
          <p className="form-error">{galat}</p>
          <div style={{ marginTop: 12 }}>
            <button type="button" className="secondary-action" onClick={() => void muatStok()}>
              Coba lagi
            </button>
          </div>
        </section>
      )}

      {adaSupabase && !muat && !galat && sesi && (
        <>
          <div className="stats-grid">
            <article className="stat-card">
              <div className="stat-top">
                <div className="stat-icon inventory">#</div>
                <span className="trend positive">
                  {ringkasan.barangDihitung} dari {sesi.barang.length}
                </span>
              </div>
              <span className="stat-label">Barang sudah dihitung</span>
              <strong>{ringkasan.barangDihitung}</strong>
              <small>barang yang jumlah di rak sudah diisi</small>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <div className="stat-icon profit">!</div>
                <span className={ringkasan.barangBeda > 0 ? "trend warning" : "trend positive"}>
                  {ringkasan.barangBeda > 0 ? "perlu ditinjau" : "aman"}
                </span>
              </div>
              <span className="stat-label">Barang beda selisih</span>
              <strong>{ringkasan.barangBeda}</strong>
              <small>tidak sama dengan stok yang tercatat</small>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <div className="stat-icon revenue">Rp</div>
                <span className={ringkasan.nilaiSusut > 0 ? "trend warning" : "trend positive"}>
                  {ringkasan.nilaiSusut > 0 ? "barang hilang" : "tidak ada"}
                </span>
              </div>
              <span className="stat-label">Nilai barang hilang</span>
              <strong>{rupiah(ringkasan.nilaiSusut)}</strong>
              <small>dihitung dari harga modal barang</small>
            </article>
          </div>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Hitung isi rak</h2>
                <p>Stok sistem sudah termasuk penjualan dan pembelian. Isi yang benar-benar ada.</p>
              </div>
            </div>

            {hasil.length === 0 ? (
              <p className="form-note">
                Belum ada barang di warung ini. Tambah barang dulu di halaman Stok Barang,
                baru bisa dihitung.
              </p>
            ) : (
              <ul className="stock-list">
                {hasil.map((item) => {
                  const id = `cek-stok-${item.barangId}`
                  const kelasChip =
                    item.status === "kurang"
                      ? "chip danger"
                      : item.status === "lebih"
                        ? "chip warn"
                        : "chip"
                  const labelChip =
                    item.status === "belum"
                      ? "belum dihitung"
                      : item.status === "cocok"
                        ? "cocok"
                        : item.status === "kurang"
                          ? `kurang ${angka(Math.abs(item.selisih ?? 0))} ${item.satuan}`
                          : `lebih ${angka(item.selisih ?? 0)} ${item.satuan}`

                  return (
                    <li className="stock-item" key={item.barangId} style={{ flexWrap: "wrap" }}>
                      <div className="product-code">{item.satuan.slice(0, 2).toUpperCase()}</div>
                      <div className="stock-info">
                        <div>
                          <strong>{item.nama}</strong>
                        </div>
                        <small>
                          Stok sistem {angka(item.stokSistem)} {item.satuan}
                          {item.selisih !== null
                            ? ` · selisih ${angka(item.selisih)} ${item.satuan}`
                            : ""}
                        </small>
                        {item.selisih !== null && <p className="form-note">{item.alasan}</p>}
                      </div>
                      <div style={{ width: 152, flex: "0 0 auto", textAlign: "right" }}>
                        <div style={{ marginBottom: 8 }}>
                          <span className={kelasChip}>{labelChip}</span>
                        </div>
                        <label className="label" htmlFor={id}>
                          Jumlah di rak
                        </label>
                        <input
                          id={id}
                          className="input"
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          placeholder={String(item.stokSistem)}
                          value={sesi.hitungan[item.barangId] ?? ""}
                          onChange={(event) => ubahHitung(item.barangId, event.target.value)}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {hasil.length > 0 && ringkasan.barangDihitung === 0 && (
              <p className="form-note">
                Belum ada barang yang dihitung. Isi kolom jumlah di rak, lalu tekan Simpan
                penyesuaian kalau sudah selesai.
              </p>
            )}

            {ringkasan.barangBeda > 0 && (
              <p className="form-note">
                {ringkasan.barangBeda} barang punya selisih. Nilai barang yang hilang{" "}
                {rupiah(ringkasan.nilaiSusut)}, nilai barang yang lebih{" "}
                {rupiah(ringkasan.nilaiLebih)}.
              </p>
            )}

            {galatSimpan && <p className="form-error">{galatSimpan}</p>}

            {sukses && (
              <div className="chip" style={{ marginTop: 12 }}>
                <Icon name="check" size={15} />
                {sukses}
              </div>
            )}

            <div
              style={{
                marginTop: 16,
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="primary-action"
                disabled={menyimpan || baris.length === 0}
                onClick={() => void simpan()}
              >
                {menyimpan ? "Menyimpan…" : "Simpan penyesuaian"}
              </button>
              <button
                type="button"
                className="secondary-action"
                disabled={menyimpan || ringkasan.barangDihitung === 0}
                onClick={mulaiUlang}
              >
                Mulai ulang hitungan
              </button>
              <p className="form-note" style={{ marginTop: 0 }}>
                {baris.length === 0
                  ? "Belum ada selisih yang perlu disimpan."
                  : `${baris.length} barang akan disesuaikan.`}
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
