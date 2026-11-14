import { useCallback, useEffect, useMemo, useState } from "react"
import { rupiah, tanggalShort } from "../lib/format"
import {
  hitungRingkasanPelanggan,
  muatBukuPelanggan,
  rataRataBelanja,
  simpanPelanggan,
  urutPelanggan,
  type DataBukuPelanggan,
  type UrutanPelanggan,
} from "../lib/pelanggan"
import { supabase } from "../lib/supabase"

/**
 * Pelanggan — buku pelanggan.
 *
 * Kasir minimarket mengingat pelanggan lewat kartu member dan barcode. Warung
 * tidak punya itu: pelanggan biasanya cuma punya nama panggilan, misalnya
 * "Pak Yono". Jadi halaman ini menyimpan orangnya — siapa yang datang, berapa
 * belanja, barang favoritnya, dan berapa utangnya.
 */
export function Pelanggan() {
  const [data, setData] = useState<DataBukuPelanggan | null>(null)
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState("")
  const [cari, setCari] = useState("")
  const [urutan, setUrutan] = useState<UrutanPelanggan>("utang")
  const [terbuka, setTerbuka] = useState<string | null>(null)

  const [nama, setNama] = useState("")
  const [telepon, setTelepon] = useState("")
  const [catatan, setCatatan] = useState("")
  const [menyimpan, setMenyimpan] = useState(false)
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null)

  const tanpaDatabase = supabase === null

  const muat = useCallback(async () => {
    if (!supabase) {
      setMemuat(false)
      return
    }
    setMemuat(true)
    setGalat("")
    try {
      setData(await muatBukuPelanggan())
    } catch (kesalahan) {
      setGalat(
        kesalahan instanceof Error ? kesalahan.message : "Gagal memuat data pelanggan.",
      )
    } finally {
      setMemuat(false)
    }
  }, [])

  useEffect(() => {
    void muat()
  }, [muat])

  const ringkasan = useMemo(() => {
    if (!data) return []
    return hitungRingkasanPelanggan(
      data.pelanggan,
      data.transaksi,
      data.baris,
      data.barang,
      data.utang,
      new Date(),
    )
  }, [data])

  const tampil = useMemo(() => {
    const kunci = cari.trim().toLocaleLowerCase("id-ID")
    const hasil = kunci
      ? ringkasan.filter(
          (p) =>
            p.nama.toLocaleLowerCase("id-ID").includes(kunci) ||
            (p.telepon ?? "").toLocaleLowerCase("id-ID").includes(kunci),
        )
      : ringkasan
    return urutPelanggan(hasil, urutan)
  }, [ringkasan, cari, urutan])

  const totalUtang = useMemo(
    () => ringkasan.reduce((sum, p) => sum + p.totalUtang, 0),
    [ringkasan],
  )
  const jumlahPunyaUtang = useMemo(
    () => ringkasan.filter((p) => p.totalUtang > 0).length,
    [ringkasan],
  )
  const rataRata = useMemo(() => rataRataBelanja(ringkasan), [ringkasan])

  async function simpan() {
    if (!nama.trim()) {
      setPesan({ ok: false, teks: "Nama panggilan pelanggan belum diisi." })
      return
    }
    setMenyimpan(true)
    setPesan(null)
    try {
      const hasil = await simpanPelanggan({ nama, telepon, catatan })
      setPesan({ ok: hasil.ok, teks: hasil.pesan })
      if (hasil.ok) {
        setNama("")
        setTelepon("")
        setCatatan("")
        await muat()
      }
    } catch (kesalahan) {
      setPesan({
        ok: false,
        teks: kesalahan instanceof Error ? kesalahan.message : "Gagal menyimpan pelanggan.",
      })
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="page-title">
        <div>
          <span className="date-label">Pelanggan</span>
          <h1>Buku pelanggan</h1>
          <p>Warung ini mengingat orangnya, bukan cuma angkanya.</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Kenapa ada buku pelanggan?</h2>
            <p>Bedanya dengan kasir minimarket: tidak perlu kartu member atau barcode.</p>
          </div>
        </div>
        <p className="form-note">
          Pelanggan warung biasanya cuma punya nama panggilan, misalnya "Pak Yono".
          Simpan nama panggilan saja sudah cukup — nomor telepon boleh dikosongkan.
          Dari situ terlihat siapa langganan tetap, siapa yang masih punya utang, dan
          barang apa yang biasa mereka beli.
        </p>
      </section>

      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">
            <div className="stat-icon revenue">#</div>
            <span className="trend positive">buku</span>
          </div>
          <span className="stat-label">Jumlah pelanggan</span>
          <strong>{ringkasan.length}</strong>
          <small>
            {ringkasan.length === 0
              ? "Belum ada pelanggan"
              : `${ringkasan.filter((p) => p.jumlahKunjungan > 0).length} di antaranya sudah pernah belanja`}
          </small>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <div className="stat-icon profit">Rp</div>
            <span className={totalUtang > 0 ? "trend warning" : "trend positive"}>utang</span>
          </div>
          <span className="stat-label">Total utang pelanggan</span>
          <strong>{rupiah(totalUtang)}</strong>
          <small>
            {jumlahPunyaUtang === 0
              ? "Semua pelanggan sudah kulang"
              : `${jumlahPunyaUtang} pelanggan masih punya utang`}
          </small>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <div className="stat-icon inventory">Rp</div>
            <span className="trend">rata-rata</span>
          </div>
          <span className="stat-label">Rata-rata belanja</span>
          <strong>{rupiah(rataRata)}</strong>
          <small>per pelanggan yang sudah pernah belanja</small>
        </article>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Daftar pelanggan</h2>
              <p>Urut dari yang paling besar utangnya</p>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <div>
              <label className="label" htmlFor="cari-pelanggan">
                Cari pelanggan
              </label>
              <input
                id="cari-pelanggan"
                className="input"
                value={cari}
                onChange={(event) => setCari(event.target.value)}
                placeholder="Cari nama panggilan atau nomor telepon"
              />
            </div>
            <div>
              <label className="label" htmlFor="urut-pelanggan">
                Urutkan
              </label>
              <select
                id="urut-pelanggan"
                className="input"
                value={urutan}
                onChange={(event) => setUrutan(event.target.value as UrutanPelanggan)}
              >
                <option value="utang">Utang terbesar dulu</option>
                <option value="belanja">Belanja terbesar dulu</option>
                <option value="nama">Nama A-Z</option>
              </select>
            </div>
          </div>

          {tanpaDatabase ? (
            <p className="form-note" style={{ marginTop: 16 }}>
              Buku pelanggan butuh koneksi ke database warung, jadi belum bisa
              menampilkan data. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY
              di berkas .env, lalu jalankan ulang pnpm dev.
            </p>
          ) : memuat ? (
            <p className="form-note" style={{ marginTop: 16 }}>
              Memuat data pelanggan…
            </p>
          ) : galat ? (
            <p className="form-error" style={{ marginTop: 16 }}>
              {galat}
            </p>
          ) : tampil.length === 0 ? (
            <p className="form-note" style={{ marginTop: 16 }}>
              {ringkasan.length === 0
                ? "Belum ada pelanggan di buku ini. Tambah nama panggilan mereka di sebelah — tidak perlu nomor telepon."
                : "Tidak ada pelanggan yang cocok dengan pencarian."}
            </p>
          ) : (
            <ul className="debt-list">
              {tampil.map((p) => (
                <li key={p.id}>
                  <div className="debt-item">
                    <div className="debt-avatar">{p.initials}</div>
                    <div>
                      <strong>{p.nama}</strong>
                      <small>
                        {p.telepon ? `${p.telepon} · ` : ""}
                        {p.jumlahKunjungan > 0 && p.kunjunganTerakhir
                          ? `${p.jumlahKunjungan} kali datang · terakhir ${tanggalShort(p.kunjunganTerakhir)}`
                          : "belum pernah datang"}
                        {p.totalUtang > 0 ? ` · utang ${rupiah(p.totalUtang)}` : ""}
                      </small>
                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <span className="chip">{p.labelKunjungan}</span>
                        <span className={p.totalUtang > 0 ? "chip danger" : "chip"}>
                          {p.labelUtang}
                        </span>
                        {p.barangFavorit && (
                          <span className="chip warn">favorit: {p.barangFavorit}</span>
                        )}
                      </div>
                    </div>
                    <b>{rupiah(p.totalBelanja)}</b>
                    <button
                      type="button"
                      className="small-action"
                      onClick={() => setTerbuka(terbuka === p.id ? null : p.id)}
                    >
                      {terbuka === p.id ? "Tutup" : "Rincian"}
                    </button>
                  </div>

                  {terbuka === p.id && (
                    <div style={{ paddingBottom: 14 }}>
                      <p className="form-note" style={{ marginTop: 10 }}>
                        Riwayat belanja {p.nama} — terbaru dulu, {p.pembelian.length} baris.
                      </p>
                      {p.pembelian.length === 0 ? (
                        <p className="form-note">
                          Belum ada pembelian yang tercatat. Pembelian 고객 terikat
                          dari kalimat suara atau nota yang menyebut namanya.
                        </p>
                      ) : (
                        <ul className="stock-list">
                          {p.pembelian.map((belanja, indeks) => (
                            <li className="stock-item" key={`${belanja.transaksiId}-${indeks}`}>
                              <div className="product-code">
                                {belanja.satuan.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="stock-info">
                                <div>
                                  <strong>{belanja.namaBarang}</strong>
                                </div>
                                <small>
                                  {belanja.jumlah} {belanja.satuan} ·{" "}
                                  {tanggalShort(belanja.tanggal)}
                                </small>
                              </div>
                              <b>{rupiah(belanja.total)}</b>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Tambah pelanggan</h2>
              <p>Nama panggilan cukup, nomor telepon tidak wajib.</p>
            </div>
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <div>
              <label className="label" htmlFor="nama-pelanggan">
                Nama panggilan
              </label>
              <input
                id="nama-pelanggan"
                className="input"
                value={nama}
                onChange={(event) => setNama(event.target.value)}
                placeholder="mis. Pak Yono"
                disabled={tanpaDatabase || menyimpan}
              />
            </div>
            <div>
              <label className="label" htmlFor="telepon-pelanggan">
                Nomor telepon (opsional)
              </label>
              <input
                id="telepon-pelanggan"
                className="input"
                value={telepon}
                onChange={(event) => setTelepon(event.target.value)}
                placeholder="mis. 0812-3456-7890"
                disabled={tanpaDatabase || menyimpan}
              />
            </div>
            <div>
              <label className="label" htmlFor="catatan-pelanggan">
                Catatan (opsional)
              </label>
              <textarea
                id="catatan-pelanggan"
                className="input"
                value={catatan}
                onChange={(event) => setCatatan(event.target.value)}
                placeholder="mis. biasa beli kopi, sering datang hari Jumat"
                disabled={tanpaDatabase || menyimpan}
              />
            </div>

            <button
              type="button"
              className="primary-action"
              onClick={() => void simpan()}
              disabled={tanpaDatabase || menyimpan || !nama.trim()}
            >
              {menyimpan ? "Menyimpan…" : "Simpan pelanggan"}
            </button>

            {pesan && (
              <p className={pesan.ok ? "form-note" : "form-error"}>
                {pesan.ok && <span className="chip">Tersimpan</span>} {pesan.teks}
              </p>
            )}

            <p className="form-note">
              Nama yang sama tidak bisa didaftarkan dua kali — "Pak Yono" dan "pak
              yono" dianggap satu orang yang sama.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
