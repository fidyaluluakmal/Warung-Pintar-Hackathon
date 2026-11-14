import { useCallback, useEffect, useMemo, useState } from "react"
import { persen, rupiah } from "../lib/format"
import { hariIniWib } from "../lib/calendar"
import { MARGIN_TARGET } from "../lib/margin"
import { supabase } from "../lib/supabase"
import { useWarung } from "../lib/store"
import { pesanUntukUser } from "../lib/pesan"
import {
  bandingkanHargaPasar,
  hitungRingkasan,
  labelKesegaran,
  saranHargaJual,
  TOLERANSI_SEPAK_PERSEN,
  type BarangPasar,
  type CatatanHargaPasar,
} from "../lib/hargaPasar"

/**
 * Harga Pasar — "di tempat lain beras 15 ribu, di sini 14 ribu".
 *
 * Warung kecil belanja sambil banding-banding. Catatan seperti itu biasanya
 * cuma ingatan di kepala, lalu hilang. Di sini dicatat, dibandingkan dengan
 * modal sendiri, lalu jadi saran harga jual.
 *
 * Halaman ini berdiri sendiri: membaca dan menulis langsung ke Supabase,
 * tanpa lewat state global, supaya bisa dipakai tanpa mengubah bagian lain
 * aplikasi.
 */
export function HargaPasar() {
  const { ubahHargaJual } = useWarung()
  const [barang, setBarang] = useState<BarangPasar[]>([])
  const [catatan, setCatatan] = useState<CatatanHargaPasar[]>([])
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState("")
  /** Kabar setelah harga pasar tersimpan. */
  const [pesan, setPesan] = useState("")
  /** Kabar setelah harga jual diubah. */
  const [pesanJual, setPesanJual] = useState("")
  const [menyimpan, setMenyimpan] = useState(false)
  const [menerapkan, setMenerapkan] = useState("")

  // Isi formulir.
  const [barangId, setBarangId] = useState("")
  const [harga, setHarga] = useState("")
  const [tempat, setTempat] = useState("")
  const [tanggal, setTanggal] = useState(hariIniWib())

  const muatData = useCallback(async () => {
    if (!supabase) {
      setGalat(
        "Fitur ini butuh koneksi ke database warung. Hubungkan aplikasi ke database, lalu jalankan ulang.",
      )
      setMemuat(false)
      return
    }

    try {
      const { data: sesi, error: errorSesi } = await supabase.auth.getUser()
      if (errorSesi) throw errorSesi
      if (!sesi.user) {
        setGalat(
          "Belum masuk. Masuk dulu supaya harga pasar tersimpan di warung Anda.",
        )
        setMemuat(false)
        return
      }

      const [daftarBarang, daftarCatatan] = await Promise.all([
        supabase
          .from("barang")
          .select("id, nama, satuan, harga_modal, harga_jual")
          .order("nama"),
        supabase
          .from("harga_pasar")
          .select("id, barang_id, harga, tempat, tanggal")
          .order("tanggal", { ascending: false }),
      ])

      if (daftarBarang.error) throw daftarBarang.error
      setBarang((daftarBarang.data ?? []).map(jadiBarang))

      if (daftarCatatan.error) {
        setCatatan([])
        setGalat(pesanGalat(daftarCatatan.error))
      } else {
        setCatatan((daftarCatatan.data ?? []).map(jadiCatatan))
      }
    } catch (kesalahan) {
      setGalat(pesanGalat(kesalahan))
    } finally {
      setMemuat(false)
    }
  }, [])

  useEffect(() => {
    void muatData()
  }, [muatData])

  const perbandingan = useMemo(
    () =>
      barang
        .map((item) => bandingkanHargaPasar(item, catatan))
        .filter((item) => item.jumlahCatatan > 0)
        // Yang paling hemat duluan — itu yang paling perlu ditindak.
        .sort((a, b) => b.selisihPersen - a.selisihPersen),
    [barang, catatan],
  )

  const ringkasan = useMemo(
    () => hitungRingkasan(perbandingan, catatan),
    [perbandingan, catatan],
  )

  async function simpanCatatan() {
    if (!supabase) return

    const nilaiHarga = Number(harga)
    if (!barangId) {
      setGalat("Pilih barangnya dulu.")
      return
    }
    if (!Number.isFinite(nilaiHarga) || nilaiHarga <= 0) {
      setGalat("Harga di tempat lain harus diisi lebih dari nol.")
      return
    }
    // Tanggal wajib diisi. Kalau kosong, string tanggal yang dikirim jadi
    // tidak valid dan database menolaknya dengan pesan yang tidak terbaca.
    if (!tanggal) {
      setGalat("Tanggal catatannya belum diisi.")
      return
    }

    setMenyimpan(true)
    setGalat("")
    setPesan("")

    try {
      const { data: sesi, error: errorSesi } = await supabase.auth.getUser()
      if (errorSesi) throw errorSesi
      const userId = sesi.user?.id
      if (!userId) {
        setGalat("Belum masuk, jadi harga pasar belum bisa disimpan.")
        return
      }

      const { error } = await supabase.from("harga_pasar").insert({
        owner_id: userId,
        barang_id: barangId,
        harga: nilaiHarga,
        tempat: tempat.trim() ? tempat.trim() : null,
        // Tanggal diisi owner sebagai hari lokal warung.
        tanggal: `${tanggal}T00:00:00+07:00`,
      })
      if (error) throw error

      const namaBarang = barang.find((item) => item.id === barangId)?.nama ?? "Barang"
      setPesan(`Harga pasar ${namaBarang} tersimpan.`)
      setHarga("")
      setTempat("")
      setTanggal(hariIniWib())
      await muatData()
    } catch (kesalahan) {
      setGalat(pesanGalat(kesalahan))
    } finally {
      setMenyimpan(false)
    }
  }

  async function terapkanHargaJual(barangId: string, hargaJual: number, nama: string) {
    if (!supabase) return

    setMenerapkan(barangId)
    setGalat("")
    setPesanJual("")

    try {
      // lewat store, bukan langsung ke database. Kalau ditulis langsung ke
      // tabel, kasir dan stok barang masih memakai harga lama sampai
      // halaman dimuat ulang.
      await ubahHargaJual(barangId, hargaJual)
      setPesanJual(`Harga jual ${nama} sudah ${rupiah(hargaJual)}.`)
    } catch (kesalahan) {
      setGalat(pesanGalat(kesalahan))
    } finally {
      setMenerapkan("")
    }
  }

  return (
    <div className="space-y-5">
      <div className="page-title">
        <div>
          <span className="date-label">Harga Pasar</span>
          <h1>Bandingkan harga pasar</h1>
          <p>Harga barang yang sama di tempat lain, dibanding modal Anda.</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Kenapa perlu dicatat?</h2>
            <p>Warung besar tahu harga barangnya di tempat lain. Warung kecil biasanya cuma ingat.</p>
          </div>
        </div>
        <p className="form-note">
          Catat harga yang Anda lihat di toko atau agen lain — misalnya "di tempat lain
          beras 15 ribu, di sini 14 ribu". Aplikasi membandingkan dengan modal Anda,
          lalu memberi saran harga jual supaya margin {MARGIN_TARGET}% tetap aman.
        </p>
      </section>

      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">
            <div className="stat-icon revenue">HP</div>
            <span className="trend positive">tercatat</span>
          </div>
          <span className="stat-label">Barang dengan data pasar</span>
          <strong>{ringkasan.jumlahBarang}</strong>
          <small>Dari {catatan.length} catatan harga</small>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <div className="stat-icon profit">%</div>
            <span className={ringkasan.rataRataHemat > 0 ? "trend positive" : "trend warning"}>
              {ringkasan.rataRataHemat > 0 ? "hemat" : "belum hemat"}
            </span>
          </div>
          <span className="stat-label">Rata-rata hemat di tempat lain</span>
          <strong>{persen(ringkasan.rataRataHemat)}</strong>
          <small>Hanya barang yang lebih murah di luar</small>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <div className="stat-icon inventory">7+</div>
            <span className={ringkasan.jumlahKedaluwarsa > 0 ? "trend warning" : "trend positive"}>
              {ringkasan.jumlahKedaluwarsa > 0 ? "perbarui" : "aman"}
            </span>
          </div>
          <span className="stat-label">Data lama</span>
          <strong>{ringkasan.jumlahKedaluwarsa}</strong>
          <small>Catatan lebih dari 7 hari</small>
        </article>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Catat harga di tempat lain</h2>
            <p>Harga barang yang sama, dilihat di toko atau agen lain.</p>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <div>
            <label className="label" htmlFor="hp-barang">
              Barang
            </label>
            <select
              id="hp-barang"
              className="input"
              value={barangId}
              onChange={(event) => setBarangId(event.target.value)}
            >
              <option value="">Pilih barang</option>
              {barang.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nama} ({item.satuan})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="hp-harga">
              Harga di sana (Rp)
            </label>
            <input
              id="hp-harga"
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              step="0.01"
              value={harga}
              onChange={(event) => setHarga(event.target.value)}
              placeholder="mis. 15000"
            />
          </div>

          <div>
            <label className="label" htmlFor="hp-temps">
              Tempat (boleh dikosongkan)
            </label>
            <input
              id="hp-temps"
              className="input"
              value={tempat}
              onChange={(event) => setTempat(event.target.value)}
              placeholder="mis. Agen Makmur"
            />
          </div>

          <div>
            <label className="label" htmlFor="hp-tanggal">
              Tanggal
            </label>
            <input
              id="hp-tanggal"
              type="date"
              className="input"
              value={tanggal}
              required
              onChange={(event) => setTanggal(event.target.value)}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="primary-action"
            disabled={menyimpan}
            onClick={() => void simpanCatatan()}
          >
            {menyimpan ? "Menyimpan…" : "Simpan harga pasar"}
          </button>
          {pesan && <span className="chip">{pesan}</span>}
        </div>

        {galat && <p className="form-error">{galat}</p>}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Perbandingan per barang</h2>
            <p>Modal Anda dibanding harga yang tercatat di tempat lain</p>
          </div>
          {pesanJual && <span className="chip">{pesanJual}</span>}
        </div>

        {memuat ? (
          <p className="form-note" style={{ marginTop: 16 }}>
            Memuat data harga pasar…
          </p>
        ) : perbandingan.length === 0 ? (
          <p className="form-note" style={{ marginTop: 16 }}>
            Belum ada harga pasar yang dicatat. Catat satu saja, lalu aplikasi
            langsung dibandingkan dengan modal Anda.
          </p>
        ) : (
          <ul className="stock-list">
            {perbandingan.map((item) => {
              const saran = saranHargaJual(item.hargaModal, item.hargaTermurah)
              const hemat = item.selisihPersen > 0
              const sama = Math.abs(item.selisihPersen) < TOLERANSI_SEPAK_PERSEN
              const persenHemat = persen(Math.abs(item.selisihPersen))
              const tempat = item.catatanTerpakai?.tempat
              return (
                <li className="stock-item" key={item.barangId}>
                  <div className="product-code">{item.satuan.slice(0, 2).toUpperCase()}</div>
                  <div className="stock-info">
                    <div>
                      <strong>{item.nama}</strong>
                      <span>{saran.verdict}</span>
                    </div>
                    <small>
                      modal {rupiah(item.hargaModal)} · termurah {rupiah(item.hargaTermurah)} ·
                      rata-rata {rupiah(item.hargaRataRata)}
                    </small>
                    <small>
                      {tempat ? `${tempat} · ` : ""}
                      {item.catatanTerpakai
                        ? labelKesegaran(item.catatanTerpakai.tanggal)
                        : "tidak ada catatan"}
                      {" · "}
                      jual sekarang {rupiah(item.hargaJual)}
                    </small>
                    <small>{saran.alasan}</small>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 6,
                    }}
                  >
                    <span className={sama || hemat ? "chip" : "chip danger"}>
                      {sama ? "sepat" : hemat ? `hemat ${persenHemat}` : `lebih mahal ${persenHemat}`}
                    </span>
                    <b style={{ fontSize: 13 }}>{rupiah(saran.hargaJual)}</b>
                    <span className="form-note" style={{ marginTop: 0 }}>
                      saran harga jual
                    </span>
                    <button
                      type="button"
                      className="small-action brand"
                      disabled={menerapkan === item.barangId}
                      onClick={() =>
                        void terapkanHargaJual(item.barangId, saran.hargaJual, item.nama)
                      }
                    >
                      {menerapkan === item.barangId ? "Menyimpan…" : "Atur harga jual"}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <p className="form-note">
          Saran harga jual = modal dibagi (1 − {MARGIN_TARGET}%), lalu dibulatkan ke atas.
          Angka ini sama dengan yang dipakai Penjaga Margin.
        </p>
      </section>
    </div>
  )
}

/** Baris dari tabel `barang` jadi bentuk yang dipakai modul harga pasar. */
function jadiBarang(baris: Record<string, unknown>): BarangPasar {
  return {
    id: String(baris.id ?? ""),
    nama: String(baris.nama ?? ""),
    satuan: String(baris.satuan ?? "pcs"),
    hargaModal: angka(baris.harga_modal),
    hargaJual: angka(baris.harga_jual),
  }
}

/** Baris dari tabel `harga_pasar` jadi bentuk yang dipakai modul harga pasar. */
function jadiCatatan(baris: Record<string, unknown>): CatatanHargaPasar {
  return {
    id: String(baris.id ?? ""),
    barangId: String(baris.barang_id ?? ""),
    harga: angka(baris.harga),
    tempat: typeof baris.tempat === "string" && baris.tempat ? baris.tempat : null,
    tanggal: String(baris.tanggal ?? new Date().toISOString()),
  }
}

/** Postgres kadang mengirim angka sebagai teks. Jadi diubah ke number. */
function angka(nilai: unknown): number {
  const hasil = typeof nilai === "number" ? nilai : Number(nilai)
  return Number.isFinite(hasil) ? hasil : 0
}

/** Error Supabase diterjemahkan jadi bahasa warung. */
function pesanGalat(kesalahan: unknown): string {
  const kode = (kesalahan as { code?: string } | null)?.code

  if (kode === "42P01" || kode === "PGRST205") {
    return "Data harga pasar belum siap di database ini. Muat ulang halaman ini sebentar lagi."
  }
  if (kode === "42501") {
    return "Anda belum masuk, jadi data harga pasar tidak bisa disimpan."
  }
  // Pesan error database berbahasa Inggris tidak ditampilkan mentah.
  return pesanUntukUser(kesalahan, "Gagal menyimpan data harga pasar. Coba lagi sebentar lagi.")
}
