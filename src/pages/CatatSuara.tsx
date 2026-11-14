import { useMemo, useRef, useState } from "react"
import { Icon } from "../components/Icon"
import { Modal } from "../components/Modal"
import { useWarung } from "../lib/store"
import { ekstrakSuara } from "../lib/api"
import { parseKalimat } from "../lib/parser"
import { rupiah } from "../lib/format"
import { pesanUntukUser } from "../lib/pesan"
import type { Satuan } from "../lib/types"

interface BarisKonfirmasi {
  nama: string
  jumlah: number
  satuan: Satuan
  hargaSatuan: number
  perluDicek: boolean
}

/**
 * Catat penjualan lewat suara.
 *
 * Alurnya: rekam -> speech-to-text -> ekstrak AI -> layar konfirmasi -> simpan.
 * Hasil AI SELALU ditampilkan untuk dikonfirmasi sebelum disimpan.
 * Kalau AI gagal, parser lokal dipakai supaya pencatatan tetap jalan.
 */
export function CatatSuara({ onClose }: { onClose?: () => void }) {
  const { barang, alias, simpanTransaksi } = useWarung()
  const [teks, setTeks] = useState("")
  const [merekam, setMerekam] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState("")
  const [baris, setBaris] = useState<BarisKonfirmasi[]>([])
  const rekamanRef = useRef<MediaRecorder | null>(null)
  const potonganRef = useRef<Blob[]>([])

  // Kamus: nama barang + alias, supaya AI memakai nama yang benar.
  const kamus = useMemo(
    () =>
      barang.map((b) => ({
        name: b.nama,
        unit: b.satuan,
        aliases: alias.filter((a) => a.barang_id === b.id).map((a) => a.alias),
      })),
    [barang, alias],
  )

  function keBarang(nama: string) {
    const kunci = nama.toLowerCase().trim()
    const cocok = barang.find((b) => b.nama.toLowerCase() === kunci)
    if (cocok) return cocok
    const cocokAlias = alias.find((a) => a.alias.toLowerCase() === kunci)
    return barang.find((b) => b.id === cocokAlias?.barang_id)
  }

  async function proses(kalimat: string) {
    setSibuk(true)
    setGalat("")
    try {
      const hasilAI = await ekstrakSuara(kalimat, kamus).catch(() => null)

      if (hasilAI && hasilAI.items.length > 0) {
        setBaris(
          hasilAI.items.map((item) => {
            const barangDitemukan = keBarang(item.name)
            return {
              nama: barangDitemukan?.nama ?? item.name,
              jumlah: item.qty,
              satuan: item.unit,
              hargaSatuan: barangDitemukan?.harga_jual ?? 0,
              perluDicek: !barangDitemukan || item.confidence < 0.7,
            }
          }),
        )
        return
      }

      // Fallback lokal: parser deterministik, tanpa AI.
      const hasilLokal = parseKalimat(kalimat)
      if (hasilLokal.items.length === 0) {
        setGalat("Tidak ada barang yang terbaca. Coba ucapkan lebih jelas.")
        return
      }
      setBaris(
        hasilLokal.items.map((item) => {
          const barangDitemukan = keBarang(item.name)
          return {
            nama: barangDitemukan?.nama ?? item.name,
            jumlah: item.qty,
            satuan: item.unit,
            hargaSatuan: barangDitemukan?.harga_jual ?? item.price ?? 0,
            perluDicek: !barangDitemukan,
          }
        }),
      )
    } catch {
      setGalat("Gagal memproses. Coba lagi atau ketik manual.")
    } finally {
      setSibuk(false)
    }
  }

  function mulaiRekam() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setGalat("Browser ini tidak mendukung rekam suara. Ketik saja kalimatnya di bawah.")
      return
    }
    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((aliran) => {
        const rekaman = new MediaRecorder(aliran)
        potonganRef.current = []
        rekaman.ondataavailable = (event) => {
          if (event.data.size > 0) potonganRef.current.push(event.data)
        }
        rekaman.onstop = () => {
          for (const track of aliran.getTracks()) track.stop()
          // Speech-to-text dilakukan lewat Web Speech API kalau tersedia.
          void transkripBrowser(rekaman, setTeks, setGalat, (hasil) => void proses(hasil))
        }
        rekaman.start()
        rekamanRef.current = rekaman
        setMerekam(true)
      })
      .catch(() => {
        setGalat("Tidak bisa akses mikrofon. Ketik saja kalimatnya di bawah.")
      })
  }

  function stopRekam() {
    rekamanRef.current?.stop()
    rekamanRef.current = null
    setMerekam(false)
  }

  async function simpan() {
    const valid = baris.filter((b) => b.jumlah > 0 && b.hargaSatuan > 0)
    if (valid.length === 0) {
      setGalat("Isi dulu jumlah dan harga barangnya.")
      return
    }
    setSibuk(true)
    setGalat("")
    try {
      await simpanTransaksi({
        tipe: "jual",
        sumber: "suara",
        teksMentah: teks,
        baris: valid.map((b) => {
          const barangDitemukan = keBarang(b.nama)
          return {
            barangId: barangDitemukan?.id ?? "",
            jumlah: b.jumlah,
            satuan: b.satuan,
            hargaSatuan: b.hargaSatuan,
          }
        }),
      })
      setBaris([])
      setTeks("")
      // Tutup modal setelah tersimpan, supaya pemilik langsung kembali ke
      // kasir dan bisa lanjut transaksi berikutnya.
      onClose?.()
    } catch (kesalahan) {
      setGalat(pesanUntukUser(kesalahan, "Gagal menyimpan. Periksa koneksi, lalu coba lagi."))
    } finally {
      setSibuk(false)
    }
  }

  return (
    <Modal label="Catat penjualan dengan suara" onClose={() => onClose?.()}>
      <span className="modal-kicker">CATAT DULU, LALU SIMPAN</span>
      <h2>Catat penjualan dengan suara</h2>
      <p>
        Ucapkan apa yang terjual. Hasilnya dicek dulu sebelum disimpan — tidak
        ada yang langsung masuk stok tanpa Anda setujui.
      </p>

      <div className="modal-actions" style={{ justifyContent: "center" }}>
        <button
          type="button"
          className="secondary-action"
          onClick={merekam ? stopRekam : mulaiRekam}
          disabled={sibuk}
        >
          <Icon name="mic" size={17} />
          {merekam ? "Berhenti rekam" : "Rekam suara"}
        </button>
      </div>

      <div className="manual-entry">
        <label htmlFor="teks-suara">Atau ketik kalimatnya</label>
        <div>
          <input
            id="teks-suara"
            value={teks}
            onChange={(event) => setTeks(event.target.value)}
            placeholder="mis. terjual 3 kilo beras dan 2 bungkus kopi"
          />
          <button
            type="button"
            onClick={() => void proses(teks)}
            disabled={sibuk || teks.trim().length === 0}
          >
            Baca
          </button>
        </div>
        <small>Contoh: “terjual 3 kilo beras dan 2 bungkus kopi”.</small>
      </div>

      {galat && <div className="form-error">{galat}</div>}

      {baris.length > 0 && (
        <>
          <span className="modal-kicker" style={{ marginTop: 22, display: "block" }}>
            PERIKSA DULU, LALU SIMPAN
          </span>
          <div className="confirm-editor">
            <div className="confirm-head">
              <span>Barang</span>
              <span>Jumlah</span>
              <span>Harga</span>
              <span />
            </div>
            {baris.map((item, index) => (
              <div className="confirm-row" key={`${item.nama}-${index}`}>
                <div className="confirm-product">
                  <input
                    value={item.nama}
                    aria-label={`Barang baris ${index + 1}`}
                    onChange={(event) =>
                      setBaris((prev) =>
                        prev.map((b, i) => (i === index ? { ...b, nama: event.target.value } : b)),
                      )
                    }
                  />
                  <div className="confirm-meta">
                    {item.perluDicek ? (
                      <span className="confidence low">periksa lagi</span>
                    ) : (
                      <span className="confidence">yakin</span>
                    )}
                    <span>{item.satuan}</span>
                  </div>
                </div>
                <div className="confirm-qty">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={item.jumlah}
                    onChange={(event) =>
                      setBaris((prev) =>
                        prev.map((b, i) =>
                          i === index ? { ...b, jumlah: Number(event.target.value) } : b,
                        ),
                      )
                    }
                    aria-label={`Jumlah ${item.nama}`}
                  />
                </div>
                <div className="confirm-price">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={item.hargaSatuan}
                    onChange={(event) =>
                      setBaris((prev) =>
                        prev.map((b, i) =>
                          i === index ? { ...b, hargaSatuan: Number(event.target.value) } : b,
                        ),
                      )
                    }
                    aria-label={`Harga ${item.nama}`}
                  />
                </div>
                <button
                  type="button"
                  className="confirm-remove"
                  onClick={() => setBaris((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`Hapus ${item.nama}`}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
            <div className="confirm-total">
              <span>Total</span>
              <strong>
                {rupiah(baris.reduce((sum, b) => sum + b.jumlah * b.hargaSatuan, 0))}
              </strong>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setBaris([])}
              disabled={sibuk}
            >
              Batal
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={() => void simpan()}
              disabled={sibuk}
            >
              <Icon name="check" size={16} /> Simpan penjualan
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

/**
 * Speech-to-text lewat Web Speech API kalau browser mendukung.
 * Kalau tidak, pengguna mengetik manual — jadi alur tetap jalan.
 */
async function transkripBrowser(
  rekaman: MediaRecorder,
  setTeks: (teks: string) => void,
  setGalat: (pesan: string) => void,
  selesai: (hasil: string) => void,
) {
  const SpeechRecognitionApi =
    typeof window !== "undefined"
      ? (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
      : undefined

  if (!SpeechRecognitionApi) {
    setGalat("Browser ini tidak bisa mengubah suara jadi teks. Ketik manual ya.")
    return
  }

  const Pengenal = SpeechRecognitionApi as new () => {
    lang: string
    interimResults: boolean
    continuous: boolean
    start: () => void
    stop: () => void
    onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
    onend: (() => void) | null
    onerror: (() => void) | null
  }

  const pengenal = new Pengenal()
  pengenal.lang = "id-ID"
  pengenal.interimResults = false
  pengenal.continuous = false

  let hasilAkhir = ""
  pengenal.onresult = (event) => {
    for (let i = 0; i < event.results.length; i += 1) {
      hasilAkhir += event.results[i][0]?.transcript ?? ""
    }
  }
  pengenal.onend = () => {
    setTeks(hasilAkhir.trim())
    if (hasilAkhir.trim()) selesai(hasilAkhir.trim())
  }
  pengenal.onerror = () => {
    setGalat("Gagal mendengar. Ketik manual ya.")
  }

  try {
    const aliran = await navigator.mediaDevices.getUserMedia({ audio: true })
    pengenal.start()
    rekaman.stop()
    for (const track of aliran.getTracks()) track.stop()
  } catch {
    pengenal.start()
  }
}
