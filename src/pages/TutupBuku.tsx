import { useMemo, useState } from "react"
import { useWarung } from "../lib/store"
import { rupiah, tanggalPanjang } from "../lib/format"
import { labaKotor, round2 } from "../lib/inventory"

/**
 * Tutup Buku — ritual harian pemilik warung.
 *
 * Satu ringkasan yang bisa langsung dikirim ke supplier (buat order) atau ke
 * pelanggan (buat tagih utang). Semua angka dari catatan hari ini.
 */
export function TutupBuku() {
  const { transaksi, baris, stok, saranBeli, utang } = useWarung()
  const [tersalin, setTersalin] = useState(false)

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

    const utangLewatTujuh = utang.filter((u) => {
      if (u.status !== "belum_lunas") return false
      const hari = Math.floor(
        (Date.now() - new Date(u.tanggal).getTime()) / 86_400_000,
      )
      return hari > 7
    })
    const totalUtangTua = utangLewatTujuh.reduce(
      (sum, u) => sum + Math.max(u.total - u.dibayar, 0),
      0,
    )

    const teks = [
      `Tutup buku ${tanggalPanjang(new Date().toISOString())}`,
      `Penjualan hari ini: ${rupiah(omzet)} dari ${penjualanHariIni.length} transaksi.`,
      `Laba kotor: ${rupiah(labaKotor(omzet, modalTerjual))}.`,
      totalUtangTua > 0
        ? `Utang lewat 7 hari: ${rupiah(totalUtangTua)} (${utangLewatTujuh.length} catatan).`
        : "Tidak ada utang lewat 7 hari.",
      saranBeli.length > 0
        ? `Perlu dibeli besok: ${saranBeli
            .slice(0, 4)
            .map((s) => `${s.nama} ${s.qty} ${s.satuan}`)
            .join(", ")}.`
        : "Stok aman, tidak ada yang perlu dibeli besok.",
    ].join("\n")

    return {
      omzet: round2(omzet),
      laba: labaKotor(omzet, modalTerjual),
      jumlahTransaksi: penjualanHariIni.length,
      totalUtangTua: round2(totalUtangTua),
      jumlahUtangTua: utangLewatTujuh.length,
      teks,
    }
  }, [transaksi, baris, stok, saranBeli, utang])

  async function salin() {
    try {
      await navigator.clipboard.writeText(ringkasan.teks)
      setTersalin(true)
      window.setTimeout(() => setTersalin(false), 2500)
    } catch {
      setTersalin(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="page-title">
        <div>
          <span className="date-label">Tutup Buku</span>
          <h1>Ringkasan hari ini</h1>
          <p>Salin, lalu kirim ke supplier atau tagih pelanggan.</p>
        </div>
      </div>

      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">
            <div className="stat-icon revenue">Rp</div>
            <span className="trend positive">{ringkasan.jumlahTransaksi} transaksi</span>
          </div>
          <span className="stat-label">Penjualan hari ini</span>
          <strong>{rupiah(ringkasan.omzet)}</strong>
          <small>Laba kotor {rupiah(ringkasan.laba)}</small>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <div className="stat-icon inventory">Rp</div>
            <span className={ringkasan.jumlahUtangTua > 0 ? "trend warning" : "trend positive"}>
              {ringkasan.jumlahUtangTua > 0 ? "perlu ditagih" : "aman"}
            </span>
          </div>
          <span className="stat-label">Utang lewat 7 hari</span>
          <strong>{rupiah(ringkasan.totalUtangTua)}</strong>
          <small>{ringkasan.jumlahUtangTua} catatan</small>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <div className="stat-icon profit">#</div>
            <span className="trend positive">besok</span>
          </div>
          <span className="stat-label">Perlu dibeli besok</span>
          <strong>{saranBeli.length}</strong>
          <small>jenis barang</small>
        </article>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Ringkasan siap kirim</h2>
            <p>Bisa langsung dikirim ke supplier atau ke pelanggan</p>
          </div>
          <button type="button" onClick={() => void salin()}>
            {tersalin ? "Tersalin" : "Salin ringkasan"}
          </button>
        </div>
        <pre
          style={{
            marginTop: 16,
            padding: 18,
            borderRadius: 12,
            background: "var(--cream)",
            border: "1px solid var(--line)",
            fontSize: 12.5,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            fontFamily: "inherit",
          }}
        >
          {ringkasan.teks}
        </pre>
      </section>
    </div>
  )
}
