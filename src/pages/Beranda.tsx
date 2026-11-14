import { useMemo, useState } from "react"
import { useWarung } from "../lib/store"
import { Icon } from "../components/Icon"
import { hariIni, rupiah, sapaan } from "../lib/format"
import { labaKotor, round2 } from "../lib/inventory"
import { mintaSaran } from "../lib/api"
import type { NavLabel } from "../lib/nav"
import type { TipsAi } from "../lib/types"

/**
 * Beranda: ringkasan hari ini + aksi cepat.
 *
 * Semua angka dihitung dari data yang sudah dimuat, bukan dari AI.
 */
export function Beranda({ onPindah }: { onPindah: (nav: NavLabel) => void }) {
  const { sesi, transaksi, baris, stok, saranBeli, utang, sinyalMargin } = useWarung()
  const [tips, setTips] = useState<TipsAi[]>([])
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState("")

  const ringkasan = useMemo(() => {
    const hariIniIso = new Date().toISOString().slice(0, 10)
    const penjualanHariIni = transaksi.filter(
      (t) => t.tipe === "jual" && t.tanggal.slice(0, 10) === hariIniIso,
    )
    const omzet = penjualanHariIni.reduce((sum, t) => sum + t.total, 0)

    const hargaModal = new Map(stok.map((s) => [s.barang_id, s.harga_modal]))
    const idsHariIni = new Set(penjualanHariIni.map((t) => t.id))
    const modalTerjual = baris
      .filter((row) => idsHariIni.has(row.transaksi_id))
      .reduce((sum, row) => sum + row.jumlah * (hargaModal.get(row.barang_id) ?? 0), 0)

    const stokTipis = stok.filter((s) => s.stok <= s.min_stok)
    const utangJalan = utang.filter((u) => u.status === "belum_lunas")
    const totalUtang = utangJalan.reduce(
      (sum, u) => sum + Math.max(u.total - u.dibayar, 0),
      0,
    )

    return {
      omzet: round2(omzet),
      labaKotor: labaKotor(omzet, modalTerjual),
      jumlahTransaksi: penjualanHariIni.length,
      stokTipis,
      totalUtang,
      utangJalan,
    }
  }, [transaksi, baris, stok, utang])

  async function mintaAi() {
    setSibuk(true)
    setGalat("")
    try {
      const hasil = await mintaSaran({
        omzetMingguIni: ringkasan.omzet,
        labaKotorMingguIni: ringkasan.labaKotor,
        stokTipis: ringkasan.stokTipis.map((s) => ({
          nama: s.nama,
          stok: s.stok,
          satuan: s.satuan,
        })),
        saranBeli: saranBeli.map((s) => ({ nama: s.nama, qty: s.qty, satuan: s.satuan })),
      })
      if (hasil && hasil.length > 0) setTips(hasil)
      else setGalat("AI belum menjawab. Angka di panel lain tetap bisa dipakai.")
    } catch {
      setGalat("AI sedang tidak bisa menjawab. Angka di panel lain tetap bisa dipakai.")
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div>
      <div className="greeting">
        <div>
          <span className="date-label">{hariIni()}</span>
          <h1>
            {sapaan()}, {sesi?.pemilik ?? "Pak Andi"}
          </h1>
          <p>Ini yang perlu dilihat hari ini di warungmu.</p>
        </div>

      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">
            <div className="stat-icon revenue">Rp</div>
            <span className="trend positive">{ringkasan.jumlahTransaksi} transaksi</span>
          </div>
          <span className="stat-label">Omzet hari ini</span>
          <strong>{rupiah(ringkasan.omzet)}</strong>
          <small>Laba kotor {rupiah(ringkasan.labaKotor)} — belum laba bersih.</small>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <div className="stat-icon profit">!</div>
            <span className="trend warning">
              {ringkasan.stokTipis.length > 0 ? "perlu dicek" : "aman"}
            </span>
          </div>
          <span className="stat-label">Stok hampir habis</span>
          <strong>{ringkasan.stokTipis.length}</strong>
          <small>dari {stok.length} barang</small>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <div className="stat-icon inventory">Rp</div>
            <span className="trend warning">belum lunas</span>
          </div>
          <span className="stat-label">Utang pelanggan</span>
          <strong>{rupiah(ringkasan.totalUtang)}</strong>
          <small>{ringkasan.utangJalan.length} catatan di buku utang</small>
        </article>
      </div>

      <div className="quick-section">
        <div className="section-heading">
          <h2>Catat cepat</h2>
          <p>Tiga cara, semuanya asks konfirmasi dulu sebelum disimpan.</p>
        </div>
        <div className="quick-grid">
          <button type="button" className="quick-card voice" onClick={() => onPindah("Catat Suara")}>
            <span className="quick-icon">
              <Icon name="mic" size={26} />
            </span>
            <span>
              <strong>Catat suara</strong>
              <small>Ucapkan barang yang terjual</small>
            </span>
            <Icon name="arrow" size={20} className="quick-arrow" />
          </button>

          <button type="button" className="quick-card receipt" onClick={() => onPindah("Foto Nota")}>
            <span className="quick-icon">
              <Icon name="camera" size={26} />
            </span>
            <span>
              <strong>Foto nota</strong>
              <small>Nota agen jadi data stok</small>
            </span>
            <Icon name="arrow" size={20} className="quick-arrow" />
          </button>

          <button type="button" className="quick-card credit" onClick={() => onPindah("Kasir")}>
            <span className="quick-icon">
              <Icon name="wallet" size={26} />
            </span>
            <span>
              <strong>Kasir · Simpen dulu</strong>
              <small>Pelanggan bayar sebagian, sisanya jadi utang</small>
            </span>
            <Icon name="arrow" size={20} className="quick-arrow" />
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Stok perlu dibeli</h2>
              <p>Dihitung dari penjualan 30 hari terakhir</p>
            </div>
            <button onClick={() => onPindah("Stok Barang")}>Lihat stok</button>
          </div>

          {saranBeli.length === 0 ? (
            <p className="form-note" style={{ marginTop: 20 }}>
              Semua stok masih di atas batas minimum. Tidak ada yang perlu dibeli.
            </p>
          ) : (
            <ul className="stock-list">
              {saranBeli.slice(0, 5).map((saran) => (
                <li className="stock-item" key={saran.barangId}>
                  <div className="product-code">{saran.satuan.slice(0, 2).toUpperCase()}</div>
                  <div className="stock-info">
                    <div>
                      <strong>{saran.nama}</strong>
                      <span>beli {saran.qty}</span>
                    </div>
                    <small>{saran.alasan}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Buku utang</h2>
              <p>Yang bayar sebagian</p>
            </div>
            <button onClick={() => onPindah("Simpen Dulu")}>Buka buku</button>
          </div>

          {ringkasan.utangJalan.length === 0 ? (
            <p className="form-note" style={{ marginTop: 20 }}>
              Buku utang bersih. Semua penjualan dibayar penuh.
            </p>
          ) : (
            <ul className="debt-list">
              {ringkasan.utangJalan.slice(0, 5).map((item) => (
                <li className="debt-item" key={item.id}>
                  <div className="debt-avatar">
                    {item.pelanggan.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <strong>{item.pelanggan}</strong>
                    <small>
                      {item.nama_barang} · {item.qty} {item.satuan}
                    </small>
                  </div>
                  <b>{rupiah(Math.max(item.total - item.dibayar, 0))}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Modal awal & untung/rugi</h2>
              <p>Uangmu bertambah atau berkurang?</p>
            </div>
            <button onClick={() => onPindah("Modal Awal")}>Buka</button>
          </div>
          <p className="form-note" style={{ marginTop: 16 }}>
            Isi modal awal sekali, lalu aplikasi membandingkan dengan posisi
            sekarang: nilai stok + laba kotor + piutang pelanggan.
          </p>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Tutup buku</h2>
              <p>Ringkasan harian, siap dikirim</p>
            </div>
            <button onClick={() => onPindah("Tutup Buku")}>Buka</button>
          </div>
          <p className="form-note" style={{ marginTop: 16 }}>
            Satu ringkasan penjualan, laba kotor, utang tua, dan daftar belanja
            besok — bisa disalin lalu dikirim ke supplier.
          </p>
        </section>
      </div>

      {sinyalMargin.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-heading">
            <div>
              <h2>Margin menyusut</h2>
              <p>Harga modal naik diam-diam — ini yang baru terasa belakangan</p>
            </div>
            <button onClick={() => onPindah("Penjaga Margin")}>Atur harga</button>
          </div>
          <ul className="stock-list">
            {sinyalMargin.slice(0, 3).map((sinyal) => (
              <li className="stock-item" key={sinyal.barangId}>
                <div className="product-code">{sinyal.satuan.slice(0, 2).toUpperCase()}</div>
                <div className="stock-info">
                  <div>
                    <strong>{sinyal.nama}</strong>
                    <span>naik {sinyal.kenaikanModalPersen}%</span>
                  </div>
                  <small>
                    Margin {sinyal.marginSebelumnya}% → {sinyal.marginSekarang}% · modal{" "}
                    {rupiah(sinyal.hargaModal)}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="advisor" id="advisor">
        <div className="advisor-copy">
          <span className="ai-label">
            <Icon name="spark" size={15} /> ASISTEN WARUNG
          </span>
          <h2>AI baca buku dagangmu</h2>
          <p>
            Angka dihitung dari catatankamu sendiri, lalu AI menyusun sarannya.
            Tidak ada angka yang dikarang — kalau datanya kurang, AI bilang begitu.
          </p>
          <button type="button" onClick={() => void mintaAi()} disabled={sibuk}>
            {sibuk ? "Membaca..." : "Minta AI membaca"}
            <Icon name="arrow" size={17} />
          </button>
          {galat && (
            <p style={{ marginTop: 12, color: "#ffd9a8", fontSize: 12 }}>{galat}</p>
          )}
        </div>
        <div className="recommendation">
          {saranBeli.slice(0, 3).map((saran) => (
            <div key={saran.barangId}>
              <span className="rec-icon">{saran.satuan.slice(0, 2).toUpperCase()}</span>
              <span>
                <small>Perlu dibeli</small>
                <strong>
                  {saran.nama} · {saran.qty} {saran.satuan}
                </strong>
              </span>
            </div>
          ))}
          {saranBeli.length === 0 && (
            <div>
              <span className="rec-icon">OK</span>
              <span>
                <small>Stok</small>
                <strong>Semua aman, tidak perlu beli apa-apa</strong>
              </span>
            </div>
          )}
        </div>
      </section>

      {tips.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-heading">
            <div>
              <h2>Bacaan AI</h2>
              <p>Dari catatan 30 hari terakhir</p>
            </div>
          </div>
          <ul className="stock-list">
            {tips.map((tip, index) => (
              <li className="stock-item" key={index}>
                <div className="product-code">
                  <Icon name="spark" size={17} />
                </div>
                <div className="stock-info">
                  <strong>{tip.text}</strong>
                  <small>{tip.reason}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

