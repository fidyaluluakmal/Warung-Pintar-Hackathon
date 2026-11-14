import { useMemo, useState } from "react"
import { useWarung } from "../lib/store"
import { Icon } from "../components/Icon"
import { hariIniWib, jamWib, selisihHari, tanggalWib } from "../lib/calendar"
import { angka, rupiah, sapaan } from "../lib/format"
import { labaKotor, round2 } from "../lib/inventory"
import {
  bacaModalAwal,
  simpanModalAwal,
  susunLaporanModal,
  type ModalAwal,
} from "../lib/capital"
import { mintaSaran } from "../lib/api"
import type { NavLabel } from "../lib/nav"
import type { TipsAi } from "../lib/types"

/**
 * Beranda: ringkasan hari ini.
 *
 * Urutannya mengikuti alur pemilik warung: kondisi hari ini -> modal awal ->
 * mau catat apa -> tutup buku -> pengeluaran -> utang -> saran AI.
 */
export function Beranda({ onPindah }: { onPindah: (nav: NavLabel) => void }) {
  const { sesi, transaksi, baris, stok, saranBeli, utang, sinyalMargin } = useWarung()
  const [tips, setTips] = useState<TipsAi[]>([])
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState("")
  const [modalAwal, setModalAwal] = useState<ModalAwal | null>(() => bacaModalAwal())
  const [modalAwalEdit, setModalAwalEdit] = useState(false)
  const [modalAwalDraft, setModalAwalDraft] = useState(() => ({
    amount: modalAwal ? String(modalAwal.amount) : "",
    since: modalAwal?.since ?? hariIniWib(),
  }))
  const [modalAwalGalat, setModalAwalGalat] = useState("")

  const ringkasan = useMemo(() => {
    const hariIni = hariIniWib()
    const penjualanHariIni = transaksi.filter(
      (t) => t.tipe === "jual" && tanggalWib(t.tanggal) === hariIni,
    )
    const pembelianHariIni = transaksi.filter(
      (t) => t.tipe === "beli" && tanggalWib(t.tanggal) === hariIni,
    )

    const omzet = penjualanHariIni.reduce((sum, t) => sum + t.total, 0)
    const belanja = pembelianHariIni.reduce((sum, t) => sum + t.total, 0)

    const hargaModal = new Map(stok.map((s) => [s.barang_id, s.harga_modal]))
    const idsHariIni = new Set(penjualanHariIni.map((t) => t.id))
    const modalTerjual = baris
      .filter((row) => idsHariIni.has(row.transaksi_id))
      .reduce((sum, row) => sum + row.jumlah * (hargaModal.get(row.barang_id) ?? 0), 0)

    const laba = labaKotor(omzet, modalTerjual)
    const stokTipis = stok.filter((s) => s.stok <= s.min_stok)
    const utangJalan = utang
    const totalUtang = utangJalan.reduce((sum, u) => sum + Math.max(u.total - u.dibayar, 0), 0)

    // Kemarin, buat pembanding.
    const kemarin = hariIniWib(new Date(Date.now() - 86_400_000))
    const penjualanKemarin = transaksi.filter(
      (t) => t.tipe === "jual" && tanggalWib(t.tanggal) === kemarin,
    )
    const omzetKemarin = penjualanKemarin.reduce((sum, t) => sum + t.total, 0)

    const laporanModal = modalAwal
      ? susunLaporanModal(modalAwal, stok, transaksi, baris, utang)
      : null

    // Pengeluaran belanja hari ini.
    const pengeluaran = transaksi.filter(
      (t) => t.tipe === "beli" && tanggalWib(t.tanggal) === hariIni,
    )

    return {
      laporanModal,
      pengeluaran,
      omzet: round2(omzet),
      labaKotor: laba,
      belanja: round2(belanja),
      bersih: round2(omzet - belanja),
      jumlahTransaksi: penjualanHariIni.length,
      omzetKemarin: round2(omzetKemarin),
      tren: omzetKemarin > 0 ? round2(((omzet - omzetKemarin) / omzetKemarin) * 100) : 0,
      margin: omzet > 0 ? round2((laba / omzet) * 100) : 0,
      stokTipis,
      totalUtang,
      utangJalan,
      totalBarang: stok.length,
    }
  }, [transaksi, baris, stok, utang, modalAwal])

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
    <>
      <section className="greeting">
        <div>
          <span className="date-label">{tanggalLengkap()}</span>
          <h1>Ringkasan hari ini</h1>
          <p>
            {sapaan()}, {sesi?.pemilik ?? "Pemilik Warung"}. Berikut kondisi warung Anda.
          </p>
        </div>
        <button className="period-button" onClick={() => onPindah("Tutup Buku")}>
          Hari ini <Icon name="down" size={16} />
        </button>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon revenue">Rp</span>
            {ringkasan.omzetKemarin > 0 && (
              <span
                className={`trend ${ringkasan.tren >= 0 ? "positive" : "warning"}`}
              >
                <Icon name={ringkasan.tren >= 0 ? "up" : "down"} size={13} />{" "}
                {angka(Math.abs(ringkasan.tren), 1)}% vs kemarin
              </span>
            )}
          </div>
          <span className="stat-label">Penjualan hari ini</span>
          <strong>{rupiah(ringkasan.omzet)}</strong>
          <small>{ringkasan.jumlahTransaksi} transaksi tercatat hari ini</small>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-icon profit">
              <Icon name="chart" size={20} />
            </span>
            <span className="trend">Margin {angka(ringkasan.margin, 1)}%</span>
          </div>
          <span className="stat-label">Laba kotor hari ini</span>
          <strong>{rupiah(ringkasan.labaKotor)}</strong>
          <small>Penjualan dikurangi modal barang terjual</small>
        </article>

        <article className="stat-card stock-summary">
          <div className="stat-top">
            <span className="stat-icon inventory">
              <Icon name="box" size={20} />
            </span>
            <span
              className={`trend ${ringkasan.stokTipis.length > 0 ? "warning" : "positive"}`}
            >
              <Icon
                name={ringkasan.stokTipis.length > 0 ? "warning" : "check"}
                size={13}
              />{" "}
              {ringkasan.stokTipis.length > 0 ? "Perlu dicek" : "Aman"}
            </span>
          </div>
          <span className="stat-label">Total jenis barang</span>
          <strong>
            {ringkasan.totalBarang} <em>barang</em>
          </strong>
          <small>
            <b>{ringkasan.stokTipis.length} barang</b> di bawah stok minimum
          </small>
        </article>
      </section>

      <section className="panel capital-panel" id="modal-awal">
        <div className="panel-heading">
          <div>
            <h2>Modal awal & untung/rugi</h2>
            <p>
              Masukkan modal yang Anda pakai mulai berjualan, lalu bandingkan dengan uang Anda
              sekarang.
            </p>
          </div>
          {modalAwal && (
            <button onClick={() => setModalAwalEdit((current) => !current)}>
              {modalAwalEdit ? "Sembunyikan" : "Ubah"} <Icon name="arrow" size={16} />
            </button>
          )}
        </div>

        {(!modalAwal || modalAwalEdit) && (
          <div className="capital-form">
            <label>
              Modal awal (stok + kas)
              <input
                inputMode="numeric"
                value={modalAwalDraft.amount}
                onChange={(event) =>
                  setModalAwalDraft({ ...modalAwalDraft, amount: event.target.value })
                }
                placeholder="Contoh: 5000000"
              />
            </label>
            <label>
              Mulai sejak
              <input
                type="date"
                value={modalAwalDraft.since}
                onChange={(event) =>
                  setModalAwalDraft({ ...modalAwalDraft, since: event.target.value })
                }
              />
            </label>
            <button
              className="primary-action"
              onClick={() => {
                const amount = Number(modalAwalDraft.amount.replace(/[^\d]/g, "")) || 0
                if (amount <= 0) {
                  setModalAwalGalat("Isi modal awalnya lebih dari nol.")
                  return
                }
                const input = { amount, since: modalAwalDraft.since }
                simpanModalAwal(input)
                setModalAwal(input)
                setModalAwalEdit(false)
                setModalAwalGalat("")
              }}
            >
              <Icon name="check" size={16} /> Simpan modal awal
            </button>
            {modalAwalGalat && <div className="form-error">{modalAwalGalat}</div>}
          </div>
        )}

        {modalAwal && ringkasan.laporanModal && (
          <>
            <div className={`capital-verdict ${ringkasan.laporanModal.verdict}`}>
              <strong>{ringkasan.laporanModal.message}</strong>
              <small>
                Modal awal {rupiah(ringkasan.laporanModal.initial)} · posisi modal sekarang{" "}
                {rupiah(ringkasan.laporanModal.estimatedNow)}
              </small>
            </div>
            <div className="capital-metrics">
              <div>
                <small>Di rak (stok)</small>
                <strong>{rupiah(ringkasan.laporanModal.stockValue)}</strong>
              </div>
              <div>
                <small>Laba kotor</small>
                <strong>{rupiah(ringkasan.laporanModal.grossProfit)}</strong>
              </div>
              <div>
                <small>Piutang (utang)</small>
                <strong>{rupiah(ringkasan.laporanModal.openDebt)}</strong>
              </div>
              <div>
                <small>Modal awal</small>
                <strong>{rupiah(ringkasan.laporanModal.initial)}</strong>
              </div>
            </div>
            <small className="ask-note">
              Perhitungan dari catatan: nilai stok memakai harga modal, laba kotor dari penjualan
              setelah tanggal modal awal, piutang dari utang yang belum lunas. Uang tunai di laci
              belum ikut dihitung.
            </small>
          </>
        )}
      </section>

      <section className="quick-section">
        <div className="section-heading">
          <div>
            <h2>Mau catat apa sekarang?</h2>
            <p>Pilih cara paling mudah untuk mencatat aktivitas warung.</p>
          </div>
        </div>
        <div className="quick-grid">
          <button type="button" className="quick-card voice" onClick={() => onPindah("Catat Suara")}>
            <span className="quick-icon">
              <Icon name="mic" size={30} />
            </span>
            <span>
              <strong>Catat dengan suara</strong>
              <small>Cukup sebutkan barang yang terjual</small>
            </span>
            <Icon name="arrow" className="quick-arrow" />
          </button>

          <button type="button" className="quick-card receipt" onClick={() => onPindah("Foto Nota")}>
            <span className="quick-icon">
              <Icon name="camera" size={30} />
            </span>
            <span>
              <strong>Foto nota belanja</strong>
              <small>Stok diperbarui setelah Anda mengonfirmasi</small>
            </span>
            <Icon name="arrow" className="quick-arrow" />
          </button>

          <button type="button" className="quick-card stockin" onClick={() => onPindah("Stok Barang")}>
            <span className="quick-icon">
              <Icon name="box" size={30} />
            </span>
            <span>
              <strong>Tambah stok manual</strong>
              <small>Catat pembelian: barang masuk, jumlah, dan biaya belanjanya</small>
            </span>
            <Icon name="arrow" className="quick-arrow" />
          </button>
        </div>
      </section>

      <section className="panel closing-panel" id="tutup-buku">
        <div className="panel-heading">
          <div>
            <h2>Tutup buku hari ini</h2>
            <p>Ringkasan singkat sebelum tutup warung: uang, utang, dan yang harus dibeli besok.</p>
          </div>
          <button onClick={() => onPindah("Tutup Buku")}>
            Buka <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="closing-inline">
          <div>
            <small>Penjualan hari ini</small>
            <strong>{rupiah(ringkasan.omzet)}</strong>
          </div>
          <div>
            <small>Laba kotor</small>
            <strong>{rupiah(ringkasan.labaKotor)}</strong>
          </div>
          <div>
            <small>Belanja stok</small>
            <strong>{rupiah(ringkasan.belanja)}</strong>
          </div>
          <div>
            <small>Sisa setelah belanja</small>
            <strong>{rupiah(ringkasan.bersih)}</strong>
          </div>
          <div>
            <small>Utang berjalan</small>
            <strong>{rupiah(ringkasan.totalUtang)}</strong>
          </div>
          <div>
            <small>Perlu restok</small>
            <strong>{ringkasan.stokTipis.length}</strong>
          </div>
        </div>
      </section>

      <section className="panel pengeluaran-panel" id="pengeluaran">
        <div className="panel-heading">
          <div>
            <h2>Pengeluaran belanja hari ini</h2>
            <p>Biaya stok yang masuk hari ini, dipotong dari penjualan untuk menghitung sisa hari ini.</p>
          </div>
          <button onClick={() => onPindah("Foto Nota")}>
            <Icon name="plus" size={16} /> Catat belanja
          </button>
        </div>
        <div className="closing-inline">
          <div>
            <small>Belanja stok</small>
            <strong>{rupiah(ringkasan.belanja)}</strong>
          </div>
          <div>
            <small>Penjualan hari ini</small>
            <strong>{rupiah(ringkasan.omzet)}</strong>
          </div>
          <div>
            <small>Sisa setelah belanja</small>
            <strong>{rupiah(ringkasan.bersih)}</strong>
          </div>
          <div>
            <small>Marjin setelah belanja</small>
            <strong>
              {angka(ringkasan.omzet > 0 ? (ringkasan.bersih / ringkasan.omzet) * 100 : 0, 1)}%
            </strong>
          </div>
        </div>
        {ringkasan.pengeluaran.length === 0 ? (
          <div className="inline-empty">
            <Icon name="receipt" size={22} />
            <strong>Belum ada pengeluaran belanja hari ini</strong>
            <span>Setelah menambah stok, biaya belanjanya muncul di sini.</span>
          </div>
        ) : (
          <div className="transaction-list">
            {ringkasan.pengeluaran.slice(0, 5).map((trx) => (
              <div className="transaction-item" key={trx.id}>
                <span className="transaction-icon orange">
                  <Icon name="down" size={19} />
                </span>
                <div>
                  <strong>{trx.agen ?? "Pembelian"} · stok masuk</strong>
                  <small>{jamWib(trx.tanggal)} WIB</small>
                </div>
                <b className="orange">−{rupiah(trx.total)}</b>
              </div>
            ))}
          </div>
        )}
        <small className="ask-note">
          Sisa setelah belanja = penjualan hari ini {rupiah(ringkasan.omzet)} − belanja stok{" "}
          {rupiah(ringkasan.belanja)}.
        </small>
      </section>

      <section className="panel utang-panel" id="simpen-dulu">
        <div className="panel-heading">
          <div>
            <h2>Simpen dulu</h2>
            <p>
              Buku utang per orang: catatannya, total, dan kapan jatuh tempo. Pelanggan warung
              sering cuma punya nama panggilan.
            </p>
          </div>
          <span className={`utang-badge ${ringkasan.utangJalan.length > 0 ? "warning" : ""}`}>
            {ringkasan.utangJalan.length > 0
              ? `${ringkasan.utangJalan.length} catatan`
              : "Lunas semua"}
          </span>
        </div>

        {ringkasan.utangJalan.length === 0 ? (
          <div className="inline-empty">
            <Icon name="check" size={22} />
            <strong>Buku utang bersih</strong>
            <span>Semua utang sudah lunas. Catat utang baru lewat suara.</span>
          </div>
        ) : (
          <>
            <div className="utang-total">
              <span>Total belum lunas</span>
              <strong>{rupiah(ringkasan.totalUtang)}</strong>
            </div>
            <div className="debtors-list">
              {ringkasan.utangJalan.slice(0, 5).map((utang) => (
                <div className="debtor-group" key={utang.id}>
                  <div className="debtor-row">
                    <div className="product-code">{inisial(utang.pelanggan)}</div>
                    <div className="debtor-main">
                      <strong>{utang.pelanggan}</strong>
                      <small>
                        {utang.nama_barang} · {utang.qty} {utang.satuan} ·{" "}
                        {hariLalu(utang.tanggal)}
                      </small>
                    </div>
                    <b>{rupiah(Math.max(utang.total - utang.dibayar, 0))}</b>
                    <button
                      className="row-action"
                      onClick={() => onPindah("Simpen Dulu")}
                      aria-label={`Kelola utang ${utang.pelanggan}`}
                    >
                      Urus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {sinyalMargin.length > 0 && (
        <section className="panel" id="margin">
          <div className="panel-heading">
            <div>
              <h2>Margin menyusut</h2>
              <p>Harga modal naik diam-diam. Ini yang baru terasa belakangan.</p>
            </div>
            <button onClick={() => onPindah("Penjaga Margin")}>
              Atur harga <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="closing-inline">
            {sinyalMargin.slice(0, 4).map((sinyal) => (
              <div key={sinyal.barangId}>
                <small>{sinyal.nama}</small>
                <strong>
                  {sinyal.marginSebelumnya}% → {sinyal.marginSekarang}%
                </strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="advisor" id="advisor">
        <div className="advisor-copy">
          <span className="ai-label">
            <Icon name="spark" size={15} /> ASISTEN WARUNG
          </span>
          <h2>AI baca buku dagangmu</h2>
          <p>
            Angka dihitung dari catatan Anda sendiri, lalu AI menyusun sarannya. Tidak ada angka
            yang dikarang — kalau datanya kurang, AI bilang begitu.
          </p>
          <button type="button" onClick={() => void mintaAi()} disabled={sibuk}>
            {sibuk ? "Membaca…" : "Minta AI membaca"}
            <Icon name="arrow" size={17} />
          </button>
          {galat && (
            <p className="advisor-note" style={{ marginTop: 12, color: "#ffd9a8", fontSize: 12 }}>
              {galat}
            </p>
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
          <div className="transaction-list">
            {tips.map((tip, index) => (
              <div className="transaction-item" key={index}>
                <span className="transaction-icon green">
                  <Icon name="spark" size={19} />
                </span>
                <div>
                  <strong>{tip.text}</strong>
                  <small>{tip.reason}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

/** Tanggal panjang berbahasa Indonesia, contoh "Sabtu, 14 November 2026". */
function tanggalLengkap(): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date())
}

function hariLalu(tanggal: string): string {
  const selisih = selisihHari(tanggal)
  if (selisih <= 0) return "hari ini"
  if (selisih === 1) return "kemarin"
  return `${selisih} hari lalu`
}

function inisial(nama: string): string {
  return nama
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((kata) => kata[0]?.toUpperCase() ?? "")
    .join("")
}
