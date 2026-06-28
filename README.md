# OrderKuota Private API (Bun + TypeScript + SQLite)

Proxy gateway pribadi untuk pembayaran QRIS OrderKuota. Mengubah QRIS statis
menjadi QRIS dinamis dengan nominal unik, melacak status pembayaran, dan
menyediakan endpoint autentikasi serta cek saldo. Dibangun di atas
[Bun](https://bun.sh) + [Hono](https://hono.dev) dengan database lokal SQLite
(`bun:sqlite`), proteksi API key, dan dokumentasi Swagger UI.

> Server ini berjalan sebagai proses long-running (bukan serverless). Semua
> data transaksi disimpan lokal di file SQLite.

---

## Fitur

- **Autentikasi OrderKuota** — request OTP dan tukar OTP menjadi token.
- **Generate QRIS dinamis** — konversi QRIS statis ke QRIS dinamis dengan
  nominal tertentu.
- **Unique amount suffix (1–999)** — setiap transaksi mendapat suffix unik
  agar nominal tidak bentrok dengan transaksi pending lain dari user yang sama.
- **Cek status pembayaran** — `pending` / `paid` / `expired` / `not_found`,
  diverifikasi terhadap mutasi QRIS di OrderKuota.
- **Generate gambar QR** — render string QRIS menjadi PNG data URL.
- **Cek saldo akun**.
- **Health check** publik (`/api/health`).
- **Swagger UI** di `/docs` untuk eksplorasi API.
- **Proteksi API key** — semua endpoint `/api/*` (kecuali health) wajib header
  `X-API-Key`.
- **Auto-cleanup** transaksi expired tiap 60 detik dan saat alokasi suffix.

---

## Persyaratan

- **Bun >= 1.1** (diuji pada Bun 1.3.4).
- **Akun OrderKuota** (untuk username + token) — diperlukan agar endpoint QRIS
  dan saldo dapat memanggil API upstream `app.orderkuota.com`.

---

## Instalasi

```bash
# 1. Install dependencies
bun install

# 2. Salin contoh environment, lalu isi API_KEY
cp .env.example .env

# 3. Jalankan dalam mode development (watch / auto-reload)
bun run dev

# 4. Atau jalankan untuk production
bun run start
```

Setelah berjalan, server akan mencetak:

```
OrderKuota Bun API listening on http://localhost:3000
Swagger UI: http://localhost:3000/docs
```

---

## Konfigurasi

Variabel environment dibaca dari `.env` (lihat `.env.example`).

| Variabel      | Wajib | Default            | Deskripsi                                                        |
|---------------|-------|--------------------|------------------------------------------------------------------|
| `API_KEY`     | Ya    | —                  | Secret bersama yang harus dikirim klien lewat header `X-API-Key`. Server gagal start bila kosong. |
| `PORT`        | Tidak | `3000`             | Port HTTP server.                                                |
| `DB_PATH`     | Tidak | `./data/orkut.db`  | Lokasi file SQLite.                                              |
| `DOCS_PUBLIC` | Tidak | `true`             | Bila `false`, dokumentasi tidak diekspos secara publik.          |
| `PROXY_URL`   | Tidak | —                  | Proxy keluar untuk request ke OrderKuota. Satu URL, atau beberapa dipisah koma untuk rotasi round-robin (proxy yang gagal dilewati 60 detik). Kosong = koneksi langsung. |

Contoh `.env`:

```env
API_KEY=ganti-dengan-secret-anda
PORT=3000
DB_PATH=./data/orkut.db
DOCS_PUBLIC=true
# Satu proxy, atau beberapa dipisah koma untuk rotasi:
PROXY_URL=http://user:pass@proxy1:8080,http://user:pass@proxy2:8080
```

---

## Autentikasi

Semua endpoint di bawah `/api/*` **kecuali** `/api/health` wajib menyertakan
header API key:

```
X-API-Key: <API_KEY>
```

Bila header tidak ada atau salah, server merespons `401`:

```json
{
  "success": false,
  "error": { "code": "UNAUTHORIZED", "message": "Invalid or missing X-API-Key" }
}
```

> Catatan: `X-API-Key` adalah secret aplikasi (proteksi gateway Anda).
> Ini berbeda dari `username` + `token` OrderKuota yang dikirim di body
> request untuk memanggil upstream.

---

## Daftar Endpoint

| Method | Endpoint               | Deskripsi                                  |
|--------|------------------------|--------------------------------------------|
| GET    | `/api/health`          | Health check (publik, tanpa API key).      |
| POST   | `/api/auth/otp`        | Request OTP ke OrderKuota.                  |
| POST   | `/api/auth/token`      | Tukar OTP menjadi token.                    |
| POST   | `/api/qris/generate`   | Generate QRIS dinamis dari QRIS statis.     |
| POST   | `/api/qris/check`      | Cek status pembayaran sebuah transaksi.     |
| POST   | `/api/qris/image`      | Render string QRIS menjadi PNG data URL.    |
| POST   | `/api/account/balance` | Cek saldo akun.                             |

Selain itu tersedia:

| Method | Endpoint        | Deskripsi                          |
|--------|-----------------|------------------------------------|
| GET    | `/docs`         | Swagger UI.                        |
| GET    | `/openapi.json` | Dokumen OpenAPI 3.1 (JSON).        |

---

## Contoh Penggunaan

Semua contoh menggunakan `curl.exe` (Windows). Ganti `<API_KEY>` dengan nilai
`API_KEY` Anda. Health check tidak memerlukan header API key.

### Health check

```bash
curl.exe http://localhost:3000/api/health
```

Response:

```json
{ "success": true, "data": { "status": "ok", "service": "orderkuota-bun" } }
```

### 1. Request OTP

```bash
curl.exe -X POST http://localhost:3000/api/auth/otp ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: <API_KEY>" ^
  -d "{\"username\":\"OK123456\",\"password\":\"passwordanda\"}"
```

Response:

```json
{ "success": true, "data": { "...": "respons OTP dari OrderKuota" } }
```

OTP akan dikirim OrderKuota ke aplikasi/SMS Anda.

### 2. Tukar OTP menjadi token

```bash
curl.exe -X POST http://localhost:3000/api/auth/token ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: <API_KEY>" ^
  -d "{\"username\":\"OK123456\",\"otp\":\"123456\"}"
```

Response:

```json
{ "success": true, "data": { "...": "berisi token, format 123456:abcdef..." } }
```

Simpan `token` ini untuk dipakai pada endpoint generate / check / balance.

### 3. Generate QRIS dinamis

```bash
curl.exe -X POST http://localhost:3000/api/qris/generate ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: <API_KEY>" ^
  -d "{\"username\":\"OK123456\",\"token\":\"123456:abcdef...\",\"amount\":10000,\"qris_static\":\"00020101021126670016COM.NOBUBANK.WWW...\"}"
```

Response:

```json
{
  "success": true,
  "data": {
    "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
    "base_amount": 10000,
    "unique_suffix": 1,
    "final_amount": 10001,
    "qris_string": "00020101021226...6304ABCD",
    "expires_at": 1750000000
  }
}
```

`final_amount` = `amount` + `unique_suffix`. Tagih pembeli sebesar
`final_amount` agar pembayaran dapat dicocokkan secara unik.

### 4. Generate gambar QR

```bash
curl.exe -X POST http://localhost:3000/api/qris/image ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: <API_KEY>" ^
  -d "{\"qris_string\":\"00020101021226...6304ABCD\",\"size\":300}"
```

Response:

```json
{ "success": true, "data": { "data_url": "data:image/png;base64,iVBORw0...", "size": 300 } }
```

Pasang `data_url` langsung pada atribut `src` sebuah elemen `<img>`.

### 5. Cek status pembayaran

```bash
curl.exe -X POST http://localhost:3000/api/qris/check ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: <API_KEY>" ^
  -d "{\"username\":\"OK123456\",\"token\":\"123456:abcdef...\",\"transaction_id\":\"550e8400-e29b-41d4-a716-446655440000\"}"
```

Response saat masih menunggu:

```json
{ "success": true, "data": { "status": "pending", "final_amount": 10001, "expires_in": 540 } }
```

Response setelah dibayar:

```json
{ "success": true, "data": { "status": "paid", "final_amount": 10001, "paid_at": 1750000123 } }
```

Kemungkinan nilai `status`: `pending`, `paid`, `expired`, `not_found`.

### 6. Cek saldo

```bash
curl.exe -X POST http://localhost:3000/api/account/balance ^
  -H "Content-Type: application/json" ^
  -H "X-API-Key: <API_KEY>" ^
  -d "{\"username\":\"OK123456\",\"token\":\"123456:abcdef...\"}"
```

Response:

```json
{ "success": true, "data": { "...": "data saldo dari OrderKuota" } }
```

---

## Walkthrough: Alur Pembayaran

1. **Generate** — panggil `POST /api/qris/generate` dengan `amount` dan
   `qris_static`. Server menyimpan transaksi `pending`, menghitung
   `final_amount` (nominal + suffix unik), dan mengembalikan `transaction_id`
   serta `qris_string`.
2. **Tampilkan QR** — render `qris_string` menjadi gambar lewat
   `POST /api/qris/image`, lalu tampilkan ke pembeli. Tagih sebesar
   `final_amount`.
3. **Poll check** — secara berkala (mis. tiap 3–5 detik) panggil
   `POST /api/qris/check` dengan `transaction_id`. Selama belum dibayar,
   `status` = `pending`.
4. **Paid** — setelah pembeli membayar tepat `final_amount`, mutasi muncul di
   OrderKuota; `check` berikutnya mengembalikan `status` = `paid`. Transaksi
   dipindah ke tabel paid dan disimpan 1 jam untuk re-verifikasi.

> Transaksi pending kedaluwarsa dalam 10 menit. Setelah itu `check`
> mengembalikan `status` = `expired` dan baris dihapus, sehingga suffix-nya
> bisa dipakai ulang.

### Pencocokan pembayaran (anti dobel-deteksi)

`check` tidak sekadar mencari mutasi dengan nominal yang sama. Setiap mutasi
OrderKuota diikat ke **satu** transaksi:

- **Klaim per `id` mutasi** — `id` mutasi yang sudah dipakai melunasi sebuah
  transaksi disimpan di `paid_transactions.mutation_id`, dan mutasi yang sudah
  diklaim akan dilewati. Index `UNIQUE(username, mutation_id)` menjadi penjaga
  atomik: **satu pembayaran hanya bisa melunasi satu transaksi**. Tanpa ini,
  dua transaksi dengan `final_amount` sama (mis. setelah suffix dipakai ulang)
  bisa sama-sama terdeteksi `paid` oleh satu kali pembayaran.
- **Filter waktu** — mutasi yang lebih lama dari `created_at` transaksi ditolak
  (timestamp `tanggal` OrderKuota diperlakukan sebagai **WIB / UTC+7**, dengan
  grace 5 menit untuk selisih jam). Ini mencegah pembayaran lama di riwayat
  mencocoki transaksi yang baru dibuat. Bila `tanggal` gagal diparse, sistem
  jatuh kembali ke proteksi klaim saja.

`check` melakukan klaim **sebelum** menghapus baris pending; bila kalah dalam
race klaim, transaksi tetap `pending` (tidak hilang).

---

## Cara Mendapatkan QRIS Static & Token

- **Token**: gunakan endpoint `POST /api/auth/otp` lalu `POST /api/auth/token`
  (lihat contoh di atas). Token berformat `123456:abcdef...`.
- **QRIS static**: ambil dari dashboard merchant OrderKuota Anda, atau scan
  gambar QRIS statis Anda menggunakan scanner QR (mis.
  [imagetotext.info/qr-code-scanner](https://www.imagetotext.info/qr-code-scanner))
  untuk memperoleh string QRIS-nya. String inilah yang dikirim sebagai
  `qris_static`.

---

## Swagger UI

Dokumentasi interaktif tersedia di:

```
http://localhost:3000/docs
```

Dokumen OpenAPI mentah (JSON) tersedia di `http://localhost:3000/openapi.json`.
Di Swagger UI, klik **Authorize** dan masukkan nilai `X-API-Key` untuk mencoba
endpoint yang terproteksi.

---

## Database

- Menggunakan **SQLite lokal** (`bun:sqlite`) pada lokasi `DB_PATH`
  (default `./data/orkut.db`).
- Mode **WAL** (`PRAGMA journal_mode = WAL`) untuk konkurensi baca/tulis yang
  lebih baik; `busy_timeout` di-set 5 detik.
- File database (`*.db`, `*.db-shm`, `*.db-wal`) dan direktori `data/`
  **di-gitignore** — tidak ikut ter-commit.

Tabel:

| Tabel                  | Isi                                                                 |
|------------------------|---------------------------------------------------------------------|
| `pending_transactions` | Transaksi yang menunggu pembayaran (id, username, base/final amount, unique_suffix, qris_string, created_at, expires_at). |
| `paid_transactions`    | Transaksi yang sudah dibayar (id, username, final_amount, paid_at, expires_at, `mutation_id`). `mutation_id` mengikat satu mutasi OrderKuota ke satu transaksi (lihat "Pencocokan pembayaran"); kolomnya ditambahkan otomatis via migrasi pada database lama. |

**Cleanup otomatis**: baris yang melewati `expires_at` dihapus secara periodik
**tiap 60 detik** (interval di `src/index.ts`) dan juga **saat alokasi suffix**
(`getAvailableSuffix` memanggil `cleanupExpired` sebelum mencari suffix kosong),
sehingga suffix yang sudah expired dapat dipakai ulang.

---

## Testing

Jalankan seluruh suite:

```bash
bun test
```

Mencakup:

- `tests/qris.test.ts` — generator QRIS (CRC16 + TLV).
- `tests/transactions.test.ts` — repository SQLite (suffix, lifecycle, cleanup).
- `tests/routes.test.ts` — integrasi route (guard API key, validasi, generate)
  dengan upstream OrderKuota di-mock.

Cek tipe TypeScript:

```bash
bun run typecheck
```

---

## Deployment

Server adalah proses long-running. Berikut beberapa opsi.

### systemd (Linux)

`/etc/systemd/system/orkut.service`:

```ini
[Unit]
Description=OrderKuota Bun API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/orderkuota-bun
ExecStart=/root/.bun/bin/bun src/index.ts
Restart=always
RestartSec=5
Environment=API_KEY=ganti-dengan-secret-anda
Environment=PORT=3000
Environment=DB_PATH=/opt/orderkuota-bun/data/orkut.db

[Install]
WantedBy=multi-user.target
```

Aktifkan:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now orkut
sudo systemctl status orkut
```

### PM2

```bash
pm2 start "bun src/index.ts" --name orkut
pm2 save
pm2 startup
```

Pastikan variabel environment (mis. `API_KEY`) sudah di-set sebelum menjalankan
`pm2 start`, atau gunakan file `.env`.

### Docker

`Dockerfile`:

```dockerfile
FROM oven/bun:1

WORKDIR /app

# Install dependencies (manfaatkan cache layer)
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Salin source
COPY . .

# Direktori data persisten untuk SQLite
RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "src/index.ts"]
```

Build & jalankan dengan volume `data/` yang persisten:

```bash
docker build -t orderkuota-bun .
docker run -d --name orkut ^
  -p 3000:3000 ^
  -e API_KEY=ganti-dengan-secret-anda ^
  -v orkut_data:/app/data ^
  orderkuota-bun
```

> Volume `data/` harus persisten agar database SQLite (transaksi pending/paid)
> tidak hilang saat container di-restart atau dibuat ulang.

---

## Catatan / Disclaimer

- Proyek ini ditujukan untuk **penggunaan pribadi** sebagai gateway proxy
  OrderKuota Anda sendiri.
- **Kredensial OrderKuota tidak disimpan** oleh server: `username` dan `token`
  hanya diteruskan ke upstream `app.orderkuota.com` per request, tidak
  dipersistensi ke database.
- Yang disimpan di SQLite hanyalah metadata transaksi QRIS (nominal, suffix,
  string QRIS, timestamp) untuk keperluan pelacakan pembayaran.
- QRIS pending kedaluwarsa dalam **10 menit**; transaksi paid disimpan
  **1 jam** untuk re-verifikasi.
- Lindungi `API_KEY` Anda dan jangan ekspos server ke publik tanpa proteksi
  tambahan (mis. reverse proxy + TLS).
