import { useMemo, useState } from "react"
import { Icon } from "./Icon"
import {
  BATAS_SESI_SIDEBAR,
  kelompokkanSesi,
  judulOtomatis,
  namaProyekDefault,
  proyekSesi,
  sesiTanpaProyek,
  urutProyek,
  type SesiLengkap,
} from "../lib/asisten"
import type { Proyek } from "../lib/types"

/**
 * Kolom kiri asisten: sesi dan proyek.
 *
 * Susunannya seperti ChatGPT: "Sesi baru" di atas, lalu daftar proyek, lalu
 * daftar sesi yang dikelompokkan per waktu.
 *
 * Proyek bisa dibuka, diberi nama, diberi instruksi, dan dihapus — semuanya
 * langsung di tempatnya, tanpa membuka jendela terpisah.
 */
export function AsistenSidebar({
  sesi,
  proyek,
  sesiAktifId,
  onPilihSesi,
  onSesiBaru,
  onBuatProyek,
  onUbahProyek,
  onHapusProyek,
  onPindahkanSesi,
  onHapusSesi,
  onUbahInstruksi,
  onPilihProyekSesiBaru,
  onTutup,
  bisaTutup,
  namaPemilik,
}: {
  sesi: SesiLengkap[]
  proyek: Proyek[]
  sesiAktifId: string | null
  onPilihSesi: (id: string) => void
  onSesiBaru: () => void
  onBuatProyek: (nama: string, instruksi: string) => Promise<void>
  onUbahProyek: (id: string, ubah: { nama?: string; instruksi?: string | null }) => Promise<void>
  onHapusProyek: (id: string) => Promise<void>
  onPindahkanSesi: (sesiId: string, proyekId: string | null) => Promise<void>
  onHapusSesi: (sesiId: string) => Promise<void>
  onUbahInstruksi: (proyekId: string, instruksi: string) => void
  onPilihProyekSesiBaru: (proyekId: string | null) => void
  onTutup?: () => void
  bisaTutup?: boolean
  namaPemilik?: string | null
}) {
  const [proyekTerbuka, setProyekTerbuka] = useState<string | null>(null)
  const [proyekSesiBaru, setProyekSesiBaru] = useState<string | null>(null)
  const [sedangBuat, setSedangBuat] = useState(false)
  const [namaBaru, setNamaBaru] = useState("")
  const [galat, setGalat] = useState("")

  const daftarProyek = useMemo(() => urutProyek(proyek, sesi), [proyek, sesi])
  const kelompok = useMemo(() => kelompokkanSesi(sesiTanpaProyek(sesi)), [sesi])

  async function buatProyek() {
    const nama = namaBaru.trim()
    if (!nama) {
      setGalat("Tulis dulu nama proyeknya.")
      return
    }
    setGalat("")
    await onBuatProyek(nama, "")
    setNamaBaru("")
    setSedangBuat(false)
  }

  return (
    <div className="asisten-kolom">
      <div className="asisten-kolom-head">
        <div>
          <strong>Asisten warung</strong>
        </div>
        {bisaTutup && onTutup && (
          <button
            type="button"
            className="modal-close asisten-tutup"
            onClick={onTutup}
            aria-label="Tutup daftar sesi"
          >
            <Icon name="close" />
          </button>
        )}
      </div>

      <button type="button" className="asisten-sesi-baru" onClick={onSesiBaru}>
        <Icon name="plus" size={15} /> Sesi baru
      </button>

      {daftarProyek.length > 0 && (
        <label className="asisten-pilih-proyek">
          <span>Sesi baru masuk ke</span>
          <select
            value={proyekSesiBaru ?? ""}
            onChange={(event) => {
              const nilai = event.target.value || null
              setProyekSesiBaru(nilai)
              onPilihProyekSesiBaru(nilai)
            }}
          >
            <option value="">Tanpa proyek</option>
            {daftarProyek.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nama}
              </option>
            ))}
          </select>
        </label>
      )}

      {daftarProyek.length > 0 && (
        <section className="asisten-grup">
          <p className="asisten-grup-label">Proyek</p>
          {daftarProyek.map((item) => {
            const isi = proyekSesi(sesi, item.id)
            const terbuka = proyekTerbuka === item.id
            return (
              <div className="asisten-proyek" key={item.id}>
                <div className="asisten-proyek-baris">
                  <button
                    type="button"
                    className={terbuka ? "asisten-proyek-nama aktif" : "asisten-proyek-nama"}
                    onClick={() => setProyekTerbuka(terbuka ? null : item.id)}
                    aria-expanded={terbuka}
                  >
                    <Icon name="box" size={14} />
                    <span>{item.nama}</span>
                    <small>{isi.length}</small>
                  </button>
                  <button
                    type="button"
                    className="asisten-proyek-aksi"
                    onClick={() => void onHapusProyek(item.id)}
                    aria-label={`Hapus proyek ${item.nama}`}
                    title="Hapus proyek"
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>

                {terbuka && (
                  <div className="asisten-proyek-isi">
                    <label className="label" htmlFor={`instruksi-${item.id}`}>
                      Instruksi proyek
                    </label>
                    <textarea
                      id={`instruksi-${item.id}`}
                      className="input"
                      rows={3}
                      defaultValue={item.instruksi ?? ""}
                      placeholder="mis. Fokus saja utang Pak Yono, jangan membawa barang lain."
                      onChange={(event) => onUbahInstruksi(item.id, event.target.value)}
                      onBlur={(event) => {
                        const nilai = event.target.value.trim()
                        if (nilai !== (item.instruksi ?? "")) {
                          void onUbahProyek(item.id, { instruksi: nilai || null })
                        }
                      }}
                    />
                    <small className="asisten-petunjuk">
                      Instruksi ini ikut ke setiap pertanyaan di proyek ini.
                    </small>

                    {isi.length > 0 && (
                      <ul className="asisten-daftar">
                        {isi.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              className={
                                s.id === sesiAktifId ? "asisten-daftar-item aktif" : "asisten-daftar-item"
                              }
                              onClick={() => {
                                onPilihSesi(s.id)
                                setProyekTerbuka(null)
                              }}
                            >
                              {s.judul}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}

      {sedangBuat ? (
        <div className="asisten-proyek-baru">
          <label className="label" htmlFor="proyek-baru">
            Nama proyek
          </label>
          <input
            id="proyek-baru"
            className="input"
            value={namaBaru}
            autoFocus
            placeholder={namaProyekDefault(namaPemilik)}
            onChange={(event) => setNamaBaru(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void buatProyek()
              if (event.key === "Escape") setSedangBuat(false)
            }}
          />
          {galat && <div className="form-error">{galat}</div>}
          <div className="asisten-proyek-baru-aksi">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setSedangBuat(false)}
            >
              Batal
            </button>
            <button type="button" className="primary-action" onClick={() => void buatProyek()}>
              Buat proyek
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="asisten-tambah-proyek"
          onClick={() => {
            setGalat("")
            setSedangBuat(true)
          }}
        >
          <Icon name="plus" size={14} /> Proyek baru
        </button>
      )}

      <section className="asisten-grup asisten-grup-sesi">
        <p className="asisten-grup-label">Sesi</p>
        {sesi.length === 0 && <p className="asisten-kosong">Belum ada percakapan.</p>}
        {kelompok.map((grup) => (
          <div className="asisten-grup-items" key={grup.kunci}>
            <p className="asisten-grup-label">{grup.label}</p>
            {grup.sesi.slice(0, BATAS_SESI_SIDEBAR).map((item) => (
              <span className="asisten-daftar-baris" key={item.id}>
                <button
                  type="button"
                  className={
                    item.id === sesiAktifId ? "asisten-daftar-item aktif" : "asisten-daftar-item"
                  }
                  onClick={() => onPilihSesi(item.id)}
                  title={item.judul}
                >
                  {item.judul || judulOtomatis(item.judul)}
                </button>
                <button
                  type="button"
                  className="asisten-proyek-aksi"
                  onClick={() => void onHapusSesi(item.id)}
                  aria-label={`Hapus sesi ${item.judul}`}
                  title="Hapus sesi"
                >
                  <Icon name="trash" size={13} />
                </button>
              </span>
            ))}
          </div>
        ))}
      </section>

      {sesiAktifId && (
        <div className="asisten-pindah">
          <label className="label" htmlFor="pindah-proyek">
            Masukkan ke proyek
          </label>
          <select
            id="pindah-proyek"
            className="input"
            value={sesi.find((s) => s.id === sesiAktifId)?.proyek_id ?? ""}
            onChange={(event) => void onPindahkanSesi(sesiAktifId, event.target.value || null)}
          >
            <option value="">Tanpa proyek</option>
            {daftarProyek.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nama}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
