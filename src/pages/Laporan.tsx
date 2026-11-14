import { useMemo, useState } from "react"
import { Icon } from "../components/Icon"
import { useWarung } from "../lib/store"
import { angka, rupiah, rupiahRingkas } from "../lib/format"
import { hariIniWib, tanggalWib } from "../lib/calendar"
import { useSekarang } from "../hooks/useSekarang"
import { labaKotor, round2 } from "../lib/inventory"
import type { NavLabel } from "../lib/nav"

type Periode = "7 hari" | "30 hari" | "3 bulan"

const PERIODE: Periode[] = ["7 hari", "30 hari", "3 bulan"]

/**
 * Laporan warung.
 *
 * Pola penjualan, laba kotor, dan barang yang paling diminati. Grafik dan
 * ringkasan membaca kumpulan data yang sama, jadi angkanya selalu cocok.
 */
export function Laporan({ onPindah }: { onPindah?: (nav: NavLabel) => void }) {
  const { transaksi, baris, stok } = useWarung()
  const sekarang = useSekarang()
  const [periode, setPeriode] = useState<Periode>("7 hari")
  const [barTerpilih, setBarTerpilih] = useState<number | null>(null)

  /**
   * Deret tanggal untuk grafik.
   *
   * Dihitung dari tanggal warung (Asia/Jakarta), bukan dari tanggal perangkat.
   * Kalau perangkat beda zona waktu, jendela grafik geser satu hari dan kartu
   * "omzet hari ini" jadi menghitung hari yang berbeda dari batang terakhir.
   */
  const hari = useMemo(() => {
    const banyak = periode === "7 hari" ? 7 : periode === "30 hari" ? 30 : 90
    const hasil: string[] = []
    const dasar = new Date(`${hariIniWib()}T00:00:00Z`)
    for (let i = banyak - 1; i >= 0; i -= 1) {
      const d = new Date(dasar.getTime() - i * 86_400_000)
      hasil.push(d.toISOString().slice(0, 10))
    }
    return hasil
  }, [periode, sekarang])

  const data = useMemo(() => {
    const hargaModal = new Map(stok.map((s) => [s.barang_id, s.harga_modal]))
    const setHari = new Set(hari)

    const penjualan = transaksi.filter(
      (t) => t.tipe === "jual" && setHari.has(tanggalWib(t.tanggal)),
    )
    const idsJual = new Set(penjualan.map((t) => t.id))

    let omzet = 0
    let modalTerjual = 0
    let barangTerjual = 0
    const perBarang = new Map<string, { qty: number; omzet: number }>()

    for (const row of baris) {
      if (!idsJual.has(row.transaksi_id)) continue
      const nama = stok.find((s) => s.barang_id === row.barang_id)?.nama ?? "Barang"
      omzet += row.jumlah * row.harga_satuan
      modalTerjual += row.jumlah * (hargaModal.get(row.barang_id) ?? 0)
      barangTerjual += row.jumlah
      const entry = perBarang.get(nama) ?? { qty: 0, omzet: 0 }
      entry.qty += row.jumlah
      entry.omzet += row.jumlah * row.harga_satuan
      perBarang.set(nama, entry)
    }

    // Deret harian untuk grafik.
    const seri = hari.map((tanggal) => {
      const harian = penjualan.filter((t) => tanggalWib(t.tanggal) === tanggal)
      return {
        tanggal,
        label: tanggal.slice(8) + "/" + tanggal.slice(5, 7),
        omzet: round2(harian.reduce((sum, t) => sum + t.total, 0)),
        transaksi: harian.length,
      }
    })

    const produkTeratas = [...perBarang.entries()]
      .map(([nama, value]) => ({ nama, ...value }))
      .sort((a, b) => b.omzet - a.omzet)
      .slice(0, 5)

    return {
      seri,
      omzet: round2(omzet),
      laba: labaKotor(omzet, modalTerjual),
      transaksi: penjualan.length,
      barangTerjual: round2(barangTerjual),
      produkTeratas,
    }
  }, [transaksi, baris, stok, hari])

  const maksOmzet = Math.max(...data.seri.map((s) => s.omzet), 1)
  const margin = data.omzet > 0 ? round2((data.laba / data.omzet) * 100) : 0
  const totalOmzetProduk = data.produkTeratas.reduce((sum, p) => sum + p.omzet, 0)

  const warna = ["var(--brand)", "var(--accent)", "#3d78ae", "#8fa3b5"]

  function pilihPeriode(nanti: Periode) {
    setPeriode(nanti)
    setBarTerpilih(null)
  }

  return (
    <div className="reports-page">
      <section className="page-title">
        <div>
          <span className="date-label">Performa usaha</span>
          <h1>Laporan warung</h1>
          <p>Lihat pola penjualan, laba kotor, dan barang yang paling diminati.</p>
        </div>
        <div className="period-tabs">
          {PERIODE.map((opsi) => (
            <button
              key={opsi}
              className={periode === opsi ? "active" : ""}
              onClick={() => pilihPeriode(opsi)}
            >
              {opsi}
            </button>
          ))}
        </div>
      </section>

      <section className="report-metrics">
        <article>
          <span>Total penjualan</span>
          <strong>{rupiah(data.omzet)}</strong>
          <small className="metric-up">
            <Icon name="up" size={13} /> {data.transaksi} transaksi
          </small>
        </article>
        <article>
          <span>Laba kotor</span>
          <strong>{rupiah(data.laba)}</strong>
          <small className="metric-up">
            <Icon name="chart" size={13} /> Margin {angka(margin, 1)}%
          </small>
        </article>
        <article>
          <span>Transaksi</span>
          <strong>{data.transaksi}</strong>
          <small>
            Rata-rata{" "}
            {rupiah(data.transaksi > 0 ? data.omzet / data.transaksi : 0)}
          </small>
        </article>
        <article>
          <span>Barang terjual</span>
          <strong>{angka(data.barangTerjual, 1)}</strong>
          <small>{data.produkTeratas.length} barang berkontribusi</small>
        </article>
      </section>

      <div className="report-grid">
        <section className="report-panel sales-chart">
          <div className="report-heading">
            <div>
              <h2>Tren penjualan</h2>
              <p>Klik batang untuk melihat detail hari itu.</p>
            </div>
            <span>
              <i /> Penjualan
            </span>
          </div>
          <div className="chart-area">
            <div className="chart-scale">
              <span>{rupiahRingkas(maksOmzet)}</span>
              <span>{rupiahRingkas(maksOmzet * 0.66)}</span>
              <span>{rupiahRingkas(maksOmzet * 0.33)}</span>
              <span>0</span>
            </div>
            <div className="bar-chart">
              {data.seri.map((titik, index) => (
                <button
                  key={titik.tanggal}
                  className={barTerpilih === index ? "active" : ""}
                  onClick={() => setBarTerpilih(barTerpilih === index ? null : index)}
                  aria-label={`${titik.label}, penjualan ${rupiah(titik.omzet)}`}
                >
                  <span className="bar-tooltip">{rupiah(titik.omzet)}</span>
                  <i style={{ height: `${(titik.omzet / maksOmzet) * 100}%` }} />
                  <small>{titik.label}</small>
                </button>
              ))}
            </div>
          </div>
          {barTerpilih !== null && data.seri[barTerpilih] && (
            <div className="chart-summary">
              <strong>{data.seri[barTerpilih].label}</strong>
              <span>{rupiah(data.seri[barTerpilih].omzet)}</span>
              <small>{data.seri[barTerpilih].transaksi} transaksi</small>
            </div>
          )}
        </section>

        <section className="report-panel profit-panel">
          <div className="report-heading">
            <div>
              <h2>Komposisi omzet</h2>
              <p>Bagian tiap barang dari total penjualan.</p>
            </div>
          </div>
          <div className="donut-wrap">
            <div
              className="donut"
              style={{
                // Setiap warna dimulai dari offset sebelumnya, bukan dari 0.
                // Kalau semua mulai dari 0, warnanya saling menimpa dan
                // lingkaran tidak cocok dengan legenda di sebelahnya.
                background: `conic-gradient(${(() => {
                  let offset = 0
                  return data.produkTeratas
                    .map((produk, index) => {
                      const bagian =
                        data.omzet > 0 ? (produk.omzet / data.omzet) * 100 : 0
                      const awal = offset
                      offset += bagian
                      return `${warna[index] ?? "#8fa3b5"} ${awal}% ${offset}%`
                    })
                    .join(", ")
                })()})`,
              }}
            >
              <div>
                <strong>{rupiahRingkas(data.omzet)}</strong>
                <small>Total omzet</small>
              </div>
            </div>
            <div className="donut-legend">
              {data.produkTeratas.map((produk, index) => (
                <p key={produk.nama}>
                  <i style={{ background: warna[index] ?? "#8fa3b5" }} />
                  <span>{produk.nama}</span>
                  <strong>
                    {angka(data.omzet > 0 ? (produk.omzet / data.omzet) * 100 : 0, 0)}%
                  </strong>
                </p>
              ))}
              {data.produkTeratas.length > 0 &&
                totalOmzetProduk < data.omzet && (
                  <p>
                    <i className="legend-gray" />
                    <span>Lainnya</span>
                    <strong>
                      {Math.max(
                        0,
                        100 - Math.round((totalOmzetProduk / Math.max(1, data.omzet)) * 100),
                      )}
                      %
                    </strong>
                  </p>
                )}
              {data.produkTeratas.length === 0 && (
                <p>
                  <i className="legend-gray" />
                  <span>Belum ada penjualan</span>
                  <strong>0%</strong>
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="report-panel top-products">
          <div className="report-heading">
            <div>
              <h2>Barang terlaris</h2>
              <p>Kontribusi terhadap penjualan</p>
            </div>
          </div>
          {data.produkTeratas.length === 0 ? (
            <div className="inline-empty">
              <Icon name="chart" size={22} />
              <strong>Belum ada penjualan di periode ini</strong>
              <span>Pilih periode lain atau catat penjualan dulu.</span>
            </div>
          ) : (
            data.produkTeratas.map((produk, index) => (
              <div className="top-product" key={produk.nama}>
                <span>{index + 1}</span>
                <div>
                  <p>
                    <strong>{produk.nama}</strong>
                    <small>{angka(produk.qty, 1)} barang terjual</small>
                  </p>
                  <div>
                    <i
                      style={{
                        width: `${Math.max(
                          3,
                          (produk.omzet / Math.max(1, data.produkTeratas[0]?.omzet ?? 1)) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <b>{rupiah(produk.omzet)}</b>
              </div>
            ))
          )}
        </section>
      </div>

      <p className="ask-note dashboard-footnote">
        Laba kotor = penjualan − modal barang terjual. Belum dipotong biaya lain seperti
        listrik dan sewa.{" "}
        <button className="secondary-action" onClick={() => onPindah?.("Stok Barang")}>
          Lihat stok
        </button>
      </p>
    </div>
  )
}
