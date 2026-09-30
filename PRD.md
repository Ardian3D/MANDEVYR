# MANDEVYR — Product Requirements Document

> Status: Draft v1.0 · 30 September 2026 · Bahasa: Indonesia

## 0. Cara membaca dokumen ini

Dokumen ini adalah sumber keputusan produk dan implementasi MANDEVYR. Jika implementasi bertentangan dengan PRD, tim mencatat alasan, dampak, dan keputusan baru di bagian *Decision log* sebelum mengubah perilaku produk.

| Atribut | Nilai |
|---|---|
Pemilik produk | Founder MANDEVYR |
Versi | 1.0, rancangan awal yang siap dipecah menjadi issue |
Target awal | Web app responsif di Arc, dimulai dari testnet lalu mainnet |
Frontend wajib | **Vite + React + TypeScript; tidak menggunakan Next.js** |
Backend MVP | Cloudflare Workers + Hono + D1 + Cron Triggers |
Model wallet | Non-custodial, wallet pengguna menandatangani aksi |
Bahasa UI awal | Inggris; struktur i18n siap untuk Indonesia |
Token | Direncanakan diluncurkan melalui **argus.world**, setelah produk nyata tersedia |
Status fitur finansial | Analisis dan simulasi dulu; eksekusi bertahap setelah gate keamanan |

**Legenda keputusan**

- **[D] Diputuskan:** wajib diikuti untuk build pertama.
- **[P] Proposal:** arah desain yang dapat diubah setelah validasi pengguna.
- **[V] Verifikasi:** fakta atau integrasi yang harus dicek ulang sebelum kode produksi/launch.
- **[G] Gate:** kondisi yang harus terpenuhi sebelum fase berikutnya dibuka.

### 0.1 Fakta eksternal yang sudah diverifikasi

1. Arc public mainnet diluncurkan 16 September 2026. Arc memakai USDC sebagai gas, kompatibel EVM, dan dokumentasi jaringan menyebut chain ID mainnet **5042** serta testnet **5042002**. Dokumentasi Arc secara khusus mengingatkan bahwa USDC native di Arc memakai **18 desimal**, dan native USDC serta representasi ERC-20-nya adalah satu saldo, sehingga UI tidak boleh menghitungnya dua kali. [Sumber: pengumuman Circle](https://www.circle.com/pressroom/circle-launches-arc-mainnet-an-economic-operating-system-for-the-internet), [koneksi Arc](https://docs.arc.io/arc/references/connect-to-arc), [perbedaan EVM Arc](https://docs.arc.io/arc/references/evm-differences).
2. Argus menyebut dirinya token launchpad di Arc. Dokumennya menampilkan pembuatan token, halaman perdagangan, pengaturan buy/sell tax, alokasi, serta reward holder; parameter yang tersedia pada saat peluncuran MANDEVYR harus dibaca ulang dari antarmuka/kontrak terbaru. [Sumber: Argus Docs](https://argus.world/docs).
3. Protokol yang relevan untuk pembayaran API agent adalah **x402** (HTTP 402 Payment Required). Sebutan “x403” dalam percakapan awal diperlakukan sebagai kemungkinan salah ketik, bukan protokol yang telah ditetapkan. Circle menunjukkan contoh endpoint berbayar USDC untuk agent pada Arc melalui Gateway. [Sumber: Circle x402](https://www.circle.com/blog/autonomous-payments-using-circle-wallets-usdc-and-x402), [Circle seller API di Arc](https://www.circle.com/blog/turn-your-api-into-a-storefront-for-agents).
4. Cloudflare Workers Free dan D1 mempunyai kuota gratis yang cukup untuk prototipe kecil, tetapi bukan kapasitas tanpa batas. Kuota dan syarat harus dicek saat deployment. [Sumber: Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

**Catatan konsistensi sumber:** indeks `llms.txt` Arc yang terindeks masih memuat kalimat “Testnet only”; halaman koneksi jaringan dan pengumuman Circle sudah menyajikan mainnet. Untuk implementasi, ikuti halaman referensi jaringan terkini dan verifikasi RPC/kontrak melalui dokumen resmi sebelum transaksi.

## 1. Ringkasan produk

### 1.1 Satu kalimat

**MANDEVYR adalah lapisan intelijen dan kontrol untuk tindakan finansial onchain di Arc: pengguna menetapkan mandat, sistem menyusun bukti dan simulasi, lalu pengguna memutuskan apakah sebuah tindakan boleh dilakukan.**

### 1.2 Masalah yang diselesaikan

Pengguna Arc akan menemukan vault yield, pembayaran agent, dan aset tokenisasi dari banyak protokol. Data yang diperlukan untuk memahami tindakan tersebar di explorer, situs issuer, kontrak, oracle, dan feed pasar. Angka APY/return mudah ditampilkan tanpa konteks sumber, usia data, likuiditas, hak redeem, atau risiko kontrak. Ketika agent dapat menemukan dan membayar layanan sendiri, pengguna juga membutuhkan batas pengeluaran dan jejak alasan yang dapat diaudit. MANDEVYR menyatukan proses **temukan → verifikasi → simulasikan → setujui → pantau**.

### 1.3 Janji produk

> “Every move, verified.”

Yang dapat dijanjikan: sumber data terlihat, kondisi mandat dapat diuji, alasan rekomendasi dapat diperiksa, aksi mempunyai simulasi dan konfirmasi, perubahan posisi dimonitor. Yang **tidak** boleh dijanjikan sebagai hasil: keuntungan, APY tetap, keamanan absolut, harga token naik, atau keberhasilan suatu transaksi.

### 1.4 Posisi produk

MANDEVYR adalah **decision workspace** untuk user dan agent. Ia tidak menjadi issuer saham, pengelola dana, broker, kustodian, DEX, atau launchpad. MANDEVYR boleh mengarahkan pengguna ke layanan pihak ketiga yang terverifikasi, namun identitas provider, kondisi akses, biaya, dan risiko tetap harus jelas di UI.

### 1.5 Differentiator yang ingin diuji

Hipotesis diferensiasi: gabungan mandat pengguna, *evidence-first preflight*, pemantauan lintas jenis aset Arc, dan API x402 untuk laporan risiko bisa menjadi kategori produk yang menonjol. Ini **bukan klaim bahwa belum ada kompetitor**; riset kompetitor dan kebaruan harus diperbarui menjelang launch.

## 2. Sasaran, batasan, dan ukuran keberhasilan

### 2.1 Outcome pengguna

1. Memahami **apa** tindakan yang diusulkan, **mengapa**, **dari mana data berasal**, dan **berapa lama data tersebut berlaku**.
2. Menetapkan batas risiko/pengeluaran yang benar-benar menghentikan rekomendasi atau aksi yang melanggarnya.
3. Mendapat peringatan relevan ketika posisi atau kondisi pasar berubah, tanpa spam.
4. Menyelesaikan tindakan yang dipilih dengan wallet sendiri, tanpa menyerahkan private key.
5. Melihat rekam keputusan dan hasil secara transparan.

### 2.2 Outcome bisnis

1. Membentuk penggunaan berulang karena laporan dan monitor berguna sebelum token diluncurkan.
2. Membuka pendapatan yang berkaitan dengan layanan nyata: laporan mendalam, API x402, paket tim, dan fitur lanjutan yang jelas.
3. Membangun alasan memiliki token yang terkait utilitas produk yang terukur, bukan narasi “harga akan naik”.

### 2.3 Non-goals fase awal

- Tidak ada auto-trading mainnet atau transaksi tanpa tanda tangan wallet pengguna.
- Tidak ada custody, pengelolaan private key, atau server wallet untuk dana pengguna.
- Tidak ada penerbitan token saham/RWA oleh MANDEVYR.
- Tidak ada “AI picks” dengan ranking return yang disajikan sebagai nasihat investasi.
- Tidak ada klaim token MANDEVYR mewakili saham, hak atas laba, dividen, atau klaim hukum lain.
- Tidak ada integrasi semua protokol Arc sekaligus; hanya adapter yang lulus pemeriksaan.
- Tidak ada target mempertahankan biaya operasional $0 pada skala besar. MVP dirancang untuk **biaya platform awal $0 dalam batas kuota**, sementara gas, transaksi, domain, AI berbayar, dan legal dapat menimbulkan biaya.

### 2.4 North star dan guardrail

**North star:** jumlah **preflight yang dibaca tuntas dan menghasilkan keputusan sadar** per minggu. Keputusan sadar = pengguna melihat hasil, membuka setidaknya satu bukti, lalu memilih *save*, *dismiss*, atau *continue*; bukan hanya klik tombol.

| Metrik | Definisi | Target eksplorasi 8 minggu setelah beta |
|---|---|---|
Activation | Wallet terhubung, mandat tersimpan, satu preflight selesai | ≥30% pengunjung yang menghubungkan wallet |
Weekly engaged wallets | Wallet dengan ≥1 keputusan sadar dalam 7 hari | Naik secara konsisten; baseline dulu |
Evidence open rate | Preflight dengan bukti sumber dibuka | ≥40% |
Monitor usefulness | Alert yang dibuka atau ditindaklanjuti / alert terkirim | ≥20%; alert palsu ditinjau |
Safety incidents | Aksi melanggar mandat atau salah jaringan/kontrak karena aplikasi | **0** |
Stale-data leakage | Hasil “fresh” padahal sumber melewati TTL | **0** |

Target ini hipotesis pengukuran, bukan janji performa bisnis.

## 3. Pengguna dan pekerjaan yang ingin dilakukan

| Persona | Tujuan | Kebutuhan utama | Hal yang harus dihindari |
|---|---|---|---|
Explorer Arc | Menjelajahi yield/RWA/pembayaran baru tanpa tersesat | Katalog kurasi, label sumber, ringkasan risiko | Daftar aset palsu atau tak jelas |
Pengguna DeFi berhati-hati | Membandingkan dua vault dan memahami exit | APY historis, likuiditas, biaya, preview redeem | “APY tinggi = aman” |
Operator agent/API | Mengontrol pengeluaran agent untuk data berbayar | Mandat biaya x402, limit harian, log bukti | Agent membayar tanpa batas |
Pemegang aset tokenisasi | Melacak issuer, redemption, exposure | Metadata issuer, hak pemegang, jadwal, sumber resmi | Menyamakan token dengan saham asli tanpa dasar |
Builder/analyst | Memakai laporan risiko lewat API | Skema stabil, provenance, harga per request | Data rahasia atau skor tanpa penjelasan |

**Prioritas MVP:** Explorer Arc dan pengguna DeFi berhati-hati. Operator agent menjadi pengguna P1. Aset tokenisasi dan saham adalah area eksplorasi yang memerlukan izin/ketersediaan produk pihak ketiga.

### 3.1 User stories utama

- Sebagai pengunjung, saya bisa melihat peluang yang didukung MANDEVYR dan kapan data terakhir diperbarui tanpa menghubungkan wallet.
- Sebagai pengguna, saya bisa membuat mandat “maksimum $100 per tindakan, hanya vault dengan withdrawal terbuka, tidak membeli layanan x402 >$0.05 per panggilan”.
- Sebagai pengguna, saya bisa membandingkan dua vault dengan angka dan tanggal sumber yang sama definisinya.
- Sebagai pengguna, saya bisa meminta preflight sebuah tindakan dan melihat alasan lulus/gagal serta bukti yang dapat diklik.
- Sebagai pengguna, saya bisa menghentikan atau mengubah mandat kapan saja.
- Sebagai pengguna, saya bisa melihat laporan preflight sebelumnya meski transaksi tidak pernah dikirim.
- Sebagai pengguna, saya bisa melihat tautan ke explorer untuk transaksi yang sudah saya tanda tangani.
- Sebagai builder, saya bisa mengonsumsi ringkasan risiko berbentuk JSON dan mengetahui versi ruleset serta usia datanya.

## 4. Prinsip desain produk

1. **Evidence first:** setiap klaim penting punya sumber, timestamp, metode perhitungan, dan status freshness.
2. **Fail closed:** jika sumber kunci gagal, tindakan berisiko tidak boleh ditampilkan sebagai “aman”.
3. **Mandate before automation:** mandat yang eksplisit dan terbaca manusia mendahului setiap tindakan agent.
4. **No hidden wallet action:** tanda tangan/transaksi selalu punya penjelasan tujuan, kontrak, nilai, gas, dan izin.
5. **Risk ≠ recommendation:** skor risiko membantu prioritisasi pemeriksaan, bukan sinyal beli.
6. **One source of truth per number:** jangan tampilkan APY, harga, atau saldo tanpa identitas provider dan definisi.
7. **Utility before token:** produk bebas dicoba dan bermanfaat sebelum peluncuran token.
8. **Honest states:** pending, unknown, stale, unsupported, dan failed harus berbeda secara visual dan tekstual.

## 5. Tahap produk dan keputusan go/no-go

| Fase | Produk yang terlihat | Kemampuan inti | Gate ke fase berikutnya |
|---|---|---|---|
P0 — Foundation | Landing, Explore, dashboard demo/live read-only | Wallet connect, Arc data, daftar vault terkurasi, sumber/freshness, watchlist lokal | Data kontrak benar, tidak ada saldo ganda |
P1 — Trusted intelligence | Mandate Studio, Preflight, Watchtower, laporan | Rule engine deterministik, SIWE, D1, cron, bukti, notifikasi in-app | Uji ruleset dan stale-data lulus; ≥20 pengguna mencoba |
P2 — Human-approved actions | Action composer untuk adapter yang disetujui | Quote/simulasi, wallet signing, receipt monitor, audit log | Audit integrasi, failure recovery, uji testnet, persetujuan owner |
P3 — Agent/API economy | x402 seller, batas belanja agent, BYOK AI | API laporan berbayar, budget agent, trace, optional natural-language planner | Permintaan nyata API, meter & refund/error handling |
P4 — Token launch | Halaman utility, verifikasi contract, integrasi Argus | Benefit holder yang telah berjalan, transparansi alokasi, analytics token | Produk aktif, benefit siap, pemeriksaan merek/hukum/kontrak selesai |

**Aturan launch token:** token bukan syarat untuk memulai P0/P1. P4 tidak dipaksakan oleh kalender; ia terjadi ketika fitur yang memberi utilitas telah digunakan dan biaya/manfaatnya terukur.

## 6. Modul dan requirement fungsional

### 6.1 Explore / Opportunity Registry — P0

**Tujuan:** menampilkan daftar peluang yang benar-benar ada dan bisa ditelusuri, bukan agregasi tak terbatas.

**Jenis entitas:** `vault`, `tokenized_asset`, `x402_service`, `payment_route`, dan `protocol`. Pada P0 hanya vault dan protokol Arc yang didukung, jenis lain dapat berstatus “research preview”.

**Field kartu wajib:** nama, jenis, jaringan, kontrak/endpoint, provider, status verifikasi provider, metrik utama + satuan, timestamp data, risk flags, link ke detail. Jika metrik tidak tersedia, tampilkan “Data belum tersedia”.

**Filter:** tipe, tingkat bukti, ketersediaan withdraw, asset dasar, risiko, status jaringan. Sort default berdasarkan kelengkapan bukti/recency, **bukan APY tertinggi**.

**Sumber masuk:** allowlist admin, bukan scraping semua token. Setiap entri mempunyai catatan `source_url`, `reviewed_at`, `contract_address`, `chain_id`, dan `support_status`. Entitas yang belum valid tidak muncul sebagai produk yang bisa ditindaklanjuti.

**Acceptance:** jika kontrak atau sumber hilang, kartu masuk status unknown dan CTA aksi nonaktif; pencarian tetap memberi pesan yang menjelaskan mengapa entitas tidak ditemukan.

### 6.2 Mandate Studio — P1

**Tujuan:** pengguna mengubah preferensi menjadi batas yang dapat dieksekusi.

**Template awal:** Conservative, Balanced, Explorer. Template hanya titik awal yang dapat diedit; label tidak menggantikan penjelasan risiko. Field MVP:

- Maksimum nominal per tindakan dan per 24 jam dalam USDC.
- Maksimum gas estimasi dalam USDC.
- Allowlist/denylist kontrak/protokol.
- Jenis aset yang diizinkan.
- Minimum tingkat bukti (`verified`, `partial`, `unknown`).
- Umur maksimum data harga/APY/risiko.
- Wajib withdraw saat ini tersedia atau tidak.
- Maksimum alokasi ke satu protokol.
- Untuk x402: harga per request, budget harian, allowlist host/endpoint.
- Opsi persetujuan: selalu manual (default); delegasi masa depan hanya setelah fitur keamanan khusus.

**Perilaku:** perubahan mandat membuat versi baru; preflight menyimpan `mandate_version`; mandat lama tetap dapat dilihat namun tidak bisa diedit. Dilarang mengubah mandat tersimpan secara diam-diam. Mandat lintas perangkat disimpan setelah SIWE; sebelum login, draft dapat hidup di local storage tanpa data sensitif.

**Acceptance:** aturan yang dilanggar menampilkan `blocked` dengan alasan spesifik dan field mana yang harus diubah; sistem tidak menyediakan tombol “ignore all” generik.

### 6.3 Preflight Engine — P1

**Input:** intent terstruktur (misalnya “deposit 50 USDC ke vault X”), alamat wallet, network, mandat versi aktif, data pasar/onchain, dan quote/simulasi jika tersedia.

**Output wajib:** keputusan `PASS | REVIEW | BLOCK | UNKNOWN`, timestamp, valid_until, ringkasan manusia, rules yang aktif, daftar bukti, angka yang dipakai, biaya/gas, risiko residual, dan `ruleset_version`.

**Urutan:** validasi input → identitas chain & kontrak → ambil snapshot sumber → hitung metrik → jalankan rule deterministik → quote/simulasi bila didukung → tulis laporan immutable → tampilkan hasil. AI boleh menjelaskan laporan, tetapi **tidak** boleh mengubah verdict deterministik.

**Verdict semantics:**

- `PASS`: semua aturan wajib lulus, data penting fresh, simulasi tersedia bila aksi akan dilakukan.
- `REVIEW`: tidak ada hard block, tetapi ada faktor yang perlu keputusan eksplisit.
- `BLOCK`: mandat dilanggar, kontrak tidak didukung, salah chain, simulasi gagal, atau risiko hard stop.
- `UNKNOWN`: data penting tidak cukup atau provider gagal; aksi tidak bisa dilanjutkan dari MANDEVYR.

**Acceptance:** laporan yang sudah kedaluwarsa tidak dapat digunakan untuk aksi; perubahan jumlah, target, wallet, chain, atau mandat memaksa preflight baru.

### 6.4 Evidence Ledger — P1

Setiap observasi memiliki `source_type`, URI/kontrak, chain/block bila onchain, `observed_at`, `fetched_at`, `ttl_seconds`, definisi metrik, hash data ringkas, dan status `fresh/stale/error`. Tautan ke block explorer dan dokumentasi issuer/protokol menjadi bagian dari UI. Tidak perlu menaruh semua laporan onchain pada MVP; hash/snapshot di D1 cukup untuk audit internal. Anchoring onchain adalah opsi P3 bila ada kebutuhan dan biaya yang masuk akal.

**Dilarang:** mengubah observasi yang telah menjadi dasar laporan lama; observasi baru menghasilkan versi baru.

### 6.5 Watchtower — P1

Pemantauan menggunakan polling terjadwal terhadap allowlist target dan posisi wallet yang dipilih pengguna. Kondisi: perubahan APY besar, data stale, vault pause, withdraw limit turun, kontrak/protokol mengubah parameter relevan, issuer memperbarui terms, volatilitas harga, dan perubahan saldo/posisi. Setiap alert memuat pemicu, data sebelum/sesudah, sumber, confidence, dan tindakan yang dapat diambil.

**MVP alert channel:** in-app dan email opsional setelah pengguna opt-in; email provider gratis harus diverifikasi kuotanya. Tanpa email, sistem tetap lengkap melalui inbox in-app. Hindari Telegram/Discord DM sampai ada consent dan integrasi resmi.

**Anti-spam:** dedupe per wallet-target-rule selama periode tertentu, severity, quiet hours, pengaturan frekuensi. Alert `critical` tidak mengirim order otomatis.

### 6.6 Yield / Vault Intelligence — P0/P1

Hanya tampilkan vault dengan kontrak dan metode yang diverifikasi. Untuk ERC-4626, gunakan `asset`, `totalAssets`, `totalSupply`, `maxDeposit`, `maxWithdraw`, `previewDeposit`, dan `previewRedeem` sesuai dukungan kontrak; standar menyatakan fungsi preview lebih sesuai untuk estimasi operasi spesifik daripada `convertTo`. [Sumber: ERC-4626](https://eips.ethereum.org/EIPS/eip-4626).

**Metrik:** APY historis/indikatif, TVL, fee, likuiditas/withdrawal, konsentrasi, provenance, umur data. APY harus menyertakan metode, jendela waktu, net/gross, dan tidak boleh dihitung dari satu titik. Jika metodologi belum dapat dibuktikan, tampilkan “APY tidak diverifikasi”.

**P2:** preview deposit/redeem dan aksi wallet setelah adapter disetujui. Ada kemungkinan vault asinkron atau syarat lain; jangan asumsikan semua vault dapat withdraw instan.

### 6.7 Tokenized Assets / Stocks — P1 riset, P3 integrasi

Satu aset tokenisasi memiliki `issuer`, `legal_claim`, `underlying`, `jurisdiction`, `eligibility`, `redemption`, `transfer_restrictions`, `oracle/source`, `contract`, dan `documents`. Jenis tampilan: `tokenized_equity`, `tokenized_fund`, `treasury_product`, `synthetic_exposure`, atau `other`. Label “stock/saham” hanya jika dokumen issuer secara eksplisit membuktikan haknya; ticker mirip saham tidak cukup.

**MVP:** daftar edukasi/riset dan detail provider yang dapat dibuktikan. **Tidak ada tombol beli** sampai jalur kelayakan, pembatasan wilayah, izin akses, dan integrasi transaksi diverifikasi. UI menunjukkan “Akses dibatasi” bila relevan; tidak menawarkan workaround.

### 6.8 x402 Payments & Agent Spend Control — P3

**Seller side:** endpoint `/api/v1/reports/{report_id}/deep-dive` dapat dijual per request USDC melalui integrasi x402/Gateway yang didukung di Arc. Response 402 harus menyebut harga, jaringan, payee, resource, expiry, dan format bukti pembayaran; permintaan yang valid memberi respons idempoten. Harga ditampilkan sebelum pembayaran. Jangan menjanjikan “gasless” untuk semua alur; implementasi Gateway dan biaya perlu dicek saat build.

**Buyer side:** agent hanya dapat membayar domain/endpoint allowlist, dengan batas per request dan per 24 jam, mencatat `purpose`, `price`, `payment_id`, `result_hash`, serta sisa budget. P2/P3 awal tetap meminta persetujuan setiap pengeluaran nyata. Delegasi otomatis memerlukan mekanisme wallet/policy resmi, audit, kill switch, dan gate tersendiri.

### 6.9 Action Composer — P2

Menampilkan tindakan yang telah lulus preflight sebagai transaksi yang bisa diperiksa. Halaman review wajib menampilkan: chain, wallet, kontrak tujuan, token/jumlah, allowance saat ini dan allowance baru jika perlu, estimasi gas USDC, slippage/price impact jika relevan, simulasi/quote, valid_until, dan tautan bukti. Tombol tindakan memanggil wallet pengguna; server hanya mengamati status.

**State machine:** `draft → preflight_ready → wallet_prompt → submitted → confirmed | reverted | dropped | unknown`. Tidak pernah menampilkan `confirmed` hanya karena wallet sudah menandatangani. Kegagalan allowance/approval harus jelas dan tidak menyebabkan pengiriman ganda.

### 6.10 Decision History & Trust Center — P1

Riwayat berisi laporan preflight, pilihan user, transaksi opsional, dan perubahan mandat. Trust Center publik menampilkan metodologi, versi ruleset, daftar adapter/provider, status data, changelog, insiden, dan batas kemampuan sistem. Pengunjung tanpa wallet dapat membaca metodologi dan status.

### 6.11 Token Hub — P4

Halaman ini menjelaskan utilitas yang **sudah aktif**, alamat kontrak resmi, link Argus/explorer, alokasi/suplai/fee, treasury, holder benefits, periode snapshot, dan risiko token. Tidak ada harga prediksi atau copy “buy before moon”. Jika token belum diluncurkan, halaman berstatus “planned” tanpa ticker/alamat yang tampak final.

## 7. Journey dan acceptance end-to-end

### J1 — Explore tanpa wallet

1. Pengunjung membuka landing dan klik “Explore”.
2. Katalog memuat kartu dengan sumber dan timestamp.
3. Pengunjung membuka detail vault, melihat bukti dan risiko.
4. CTA “Create a mandate” membuka alur wallet hanya bila pengguna ingin menyimpan.

**Lulus jika:** data publik bisa dilihat tanpa koneksi wallet; satu entitas unsupported tidak merusak daftar; setiap metrik mempunyai label kondisi data.

### J2 — Mandat → preflight → keputusan

1. Pengguna menghubungkan wallet Arc dan login SIWE.
2. Pengguna memilih template, mengubah batas, menyimpan.
3. Pengguna memilih `deposit 50 USDC` pada vault yang didukung.
4. Preflight menunjukkan verdict, alasan, bukti, dan masa berlaku.
5. Pengguna menyimpan, membatalkan, atau melanjutkan ke review aksi (bila P2 aktif).

**Lulus jika:** tindakan $120 diblokir saat maksimum $100; perubahan maksimum menjadi $150 membuat versi mandat baru dan memerlukan preflight baru.

### J3 — Alert

1. Pengguna menambah vault ke watchlist.
2. Poller mendeteksi withdrawal ditutup atau data penting stale.
3. Satu alert terdeduplikasi muncul dengan bukti.
4. Pengguna membuka alert dan dapat membuat preflight baru.

**Lulus jika:** alert tidak menyatakan transaksi gagal/berhasil tanpa bukti; notifikasi duplikat tidak membanjiri inbox.

### J4 — Pembayaran x402

1. Agent meminta laporan mendalam.
2. Endpoint memberi harga dan syarat 402.
3. Mandat memeriksa host, endpoint, nominal, serta budget.
4. Pengguna menyetujui pembayaran, atau agent dengan delegasi valid melanjutkan.
5. API memverifikasi settlement dan memberi laporan beserta ID pembayaran.

**Lulus jika:** budget habis menolak permintaan; retry tidak menagih dua kali; hasil 402 tanpa pembayaran tidak membocorkan konten premium.

## 8. Information architecture dan desain UI

### 8.1 Rute utama

| Rute | Akses | Isi |
|---|---|---|
 `/` | Publik | Hero, demonstrasi preflight, manfaat, metodologi ringkas |
 `/explore` | Publik | Katalog peluang dan filter |
 `/explore/:id` | Publik | Detail entitas, sumber, risiko, batas dukungan |
 `/app` | Login | Mission Control / dashboard |
 `/app/mandate` | Login | Editor dan versi mandat |
 `/app/preflight/new` | Login | Form intent |
 `/app/preflight/:id` | Login pemilik | Laporan preflight |
 `/app/watch` | Login | Watchlist dan alert |
 `/app/history` | Login | Riwayat keputusan |
 `/app/settings` | Login | Wallet, privasi, notifikasi |
 `/trust` | Publik | Metodologi, status, adapter, changelog |
 `/token` | Publik | Rencana/utility dan kemudian kontrak resmi |
 `/api/docs` | Publik | Dokumentasi API saat tersedia |

### 8.2 Dashboard “Mission Control”

**Above the fold desktop:** header dengan status Arc/RPC dan wallet; kiri *Mandate health* (batas dan mode), tengah *Next best checks* (hal yang perlu diperiksa, bukan “top buy”), kanan *Evidence pulse* (data fresh/stale/unknown). Baris kedua: watchlist, alerts, recent decisions, dan “Create preflight”. Paling bawah: Activity timeline dan education cards yang menjelaskan risiko.

**Mobile:** satu kolom; mandat dan alert di atas grafik; CTA utama tetap terlihat; tabel berubah menjadi kartu yang bisa di-scroll tanpa horizontal overflow. Minimal target sentuh 44px. Teks status tidak bergantung pada warna saja.

**States wajib di setiap widget:** loading skeleton, empty, stale, partial, error/retry, disconnected, wrong network, unsupported, success. Tidak ada angka palsu yang tetap tampak seperti data live.

### 8.3 Visual system [P]

- Warna inti: midnight navy `#0B1220`, mint `#49E3B1`, warm white `#F6F8F5`.
- Semantik: hijau = rule lulus; amber = perlu review; merah = blokir; abu/biru = unknown. Kontras minimal WCAG AA.
- Tipografi: sans-serif yang tersedia bebas lisensi dan angka tabular untuk metrik.
- Grafik: tampilkan unit, rentang, sumber, dan last updated di grafik itu sendiri.
- Ikon: geometri M/diamond verifikasi; jangan memakai simbol Circle/Arc seolah afiliasi resmi.
- Nada copy: jelas dan jujur. Contoh: “Data APY terakhir diperbarui 37 menit lalu” alih-alih “safe yield”.

### 8.4 UI untuk verdict

Setiap hasil preflight menampilkan satu banner yang konsisten: verdict, ringkasan satu kalimat, tiga faktor paling menentukan, panel bukti yang bisa dibuka, blok angka/biaya, batas waktu, dan CTA yang sesuai. `BLOCK`/ `UNKNOWN` tidak mempunyai CTA “execute”. `REVIEW` mengharuskan pengguna membuka risiko yang belum dipastikan sebelum melanjutkan di P2.

### 8.5 Aksesibilitas dan lokalisasi

Keyboard navigation penuh, fokus terlihat, modal yang tidak menjebak, label form, live region untuk status transaksi, tanggal dan angka yang konsisten dengan locale, dan teks ringkas yang tidak hanya mengandalkan tooltip. String UI disimpan dalam katalog i18n; bahasa Inggris pertama, Indonesia berikutnya. Format USDC memakai jumlah desimal sesuai konteks, namun nilai mentah dan satuan tidak hilang.

## 9. Model keputusan dan kualitas data

### 9.1 Klasifikasi sumber

| Level | Arti | Boleh untuk tindakan? |
|---|---|---|
Verified | Alamat kontrak/issuer/endpoint cocok dengan sumber resmi yang di-review manual; data fresh | Ya, jika semua gate lain lulus |
Partial | Sebagian bukti ada, tetapi satu komponen penting belum lengkap | Maksimal REVIEW atau UNKNOWN |
Unverified | Sumber tidak dapat dibuktikan | Tidak |
Disputed | Dua sumber bertentangan | Tidak sampai ditinjau |

“Verified” berarti **identitas/sumber telah dicek**, bukan aman atau bebas risiko.

### 9.2 Contoh rule MVP

| Rule ID | Kondisi | Verdict minimal |
|---|---|---|
R-CHAIN-001 | Chain wallet ≠ chain intent | BLOCK |
R-CONTRACT-001 | Kontrak tidak ada di allowlist adapter | BLOCK |
R-DATA-001 | Data kritikal melewati TTL | UNKNOWN |
R-BUDGET-001 | Nominal > maksimum tindakan | BLOCK |
R-BUDGET-002 | Akumulasi 24 jam + nominal > limit | BLOCK |
R-GAS-001 | Estimasi gas > batas | BLOCK |
R-WITHDRAW-001 | Mandat mewajibkan withdraw tersedia; `maxWithdraw=0` | BLOCK |
R-X402-001 | Host/endpoint di luar allowlist | BLOCK |
R-X402-002 | Harga request > batas | BLOCK |
R-SIM-001 | Simulasi aksi gagal | BLOCK |
R-EVIDENCE-001 | Bukti issuer/legal claim aset tokenisasi belum ada | UNKNOWN |

Ruleset dijalankan dalam urutan tetap, menggunakan angka integer/decimal yang aman, dan dicatat dalam laporan. Skor numerik boleh ditambahkan untuk prioritas tampilan, tetapi **tidak** boleh menyembunyikan hard block atau menyamar sebagai probabilitas keamanan.

### 9.3 TTL default [P]

| Jenis data | TTL awal | Jika kedaluwarsa |
|---|---:|---|
Chain ID, kontrak target, allowance saat action | Dibaca ulang saat preflight/submit | BLOCK/UNKNOWN |
Saldo wallet dan gas | 30 detik saat action | Refresh wajib |
Quote/preview deposit/withdraw | 30–60 detik atau expiry provider | Aksi nonaktif |
APY indikatif | 15 menit jika feed tersedia; data historis diberi label sesuai periode | Label stale; tidak mengklaim live |
Terms issuer/dokumen legal | Review manual saat ada update; umur review ditampilkan | Aset tidak bisa ditindaklanjuti |
Status vault pause/withdraw | 1–5 menit sesuai kemampuan sumber | UNKNOWN bila tidak fresh |

TTL ini harus disesuaikan dengan sifat sumber. Jika free RPC tidak sanggup, kurangi cakupan, bukan diam-diam memperpanjang TTL.

### 9.4 Konflik dan koreksi

Jika dua sumber bertentangan, tampilkan keduanya, tandai disputed, tahan aksi, dan buka issue review. Perbaikan data menghasilkan observasi/laporan baru; riwayat lama menyimpan apa yang diketahui saat keputusan dibuat. Admin hanya dapat mengubah status entitas lewat audit log.

## 10. Arsitektur teknis

### 10.1 Keputusan stack [D]

| Lapisan | Pilihan | Alasan |
|---|---|---|
Web | **Vite + React + TypeScript** | SPA cepat, build statis, tanpa kebutuhan SSR di MVP |
Routing | React Router | Rute publik dan app yang terpisah jelas |
UI | Tailwind CSS + komponen berbasis Radix/shadcn-style + Lucide | Konsistensi, aksesibilitas, dapat dikustomisasi |
Data fetching | TanStack Query | Cache, retry terkendali, stale states |
Grafik | Recharts atau lightweight-charts setelah spike | Grafik jelas; pilih satu berdasarkan ukuran bundle |
Wallet | wagmi + viem | Dukungan Arc EVM, typed calls, simulasi, read contracts |
API | Hono di Cloudflare Worker | Satu origin dengan SPA; middleware ringan |
DB | Cloudflare D1 (SQLite) | Cukup untuk data pengguna, laporan, alert, dan katalog MVP |
Jobs | Cloudflare Cron Trigger | Polling terbatas untuk sumber terkurasi |
Auth | SIWE / ERC-4361 + secure cookie session | Wallet login tanpa password |
Validasi | Zod atau validator setara | Skema request/response/runtime |
Observability | Log JSON terstruktur + Cloudflare analytics gratis | Diagnosis tanpa menyimpan rahasia |
AI | Opsional, adapter BYOK atau local dev; core rules deterministik | Produk tetap berfungsi dengan biaya AI nol |
Testing | Vitest + Playwright + simulasi RPC testnet | Keputusan finansial memerlukan uji aturan dan alur |

Cloudflare mendokumentasikan kombinasi React SPA, Hono, Vite, dan Worker static assets dalam satu aplikasi; static assets bisa disajikan tanpa memanggil Worker. [Sumber: Cloudflare Hono guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/), [Static Assets](https://developers.cloudflare.com/workers/static-assets/).

**Tidak boleh memakai Next.js** untuk build ini. Jika kelak butuh SEO untuk landing, gunakan HTML metadata statis, sitemap, dan prerender build-time Vite bila perlu. Jangan diam-diam mengganti framework.

### 10.2 Topologi

```text
Browser (Vite React SPA)
  ├─ wallet provider (signing milik pengguna)
  ├─ Arc RPC / viem read; write hanya setelah review
  └─ same-origin /api/*
             ↓
Cloudflare Worker (Hono + static assets + scheduled)
  ├─ auth SIWE + sessions
  ├─ registry/mandates/preflight/reports/alerts
  ├─ adapter Arc RPC + provider eksternal allowlist
  ├─ deterministic rules engine
  ├─ x402 adapter [P3]
  └─ D1 (catalog, snapshots, reports, history)
```

**Keputusan biaya:** satu Worker menjalankan assets, API, dan cron pada MVP. Jika jobs mulai bersaing dengan API, pindahkan ke Worker kedua tanpa mengubah kontrak API. Dalam mode gratis, jumlah entitas yang dipantau dibatasi agar CPU, subrequest, dan D1 tetap dalam kuota.

**Feasibility spike wajib sebelum mengunci hosting:** ukur waktu CPU untuk verifikasi SIWE, preflight rule engine, dan satu batch cron pada Worker Free yang dibangun sungguhan. Batas 10 ms CPU per request dapat terlalu ketat untuk kombinasi kriptografi, parsing, dan banyak aturan. Bila salah satu alur inti melampaui batas secara konsisten, sederhanakan pekerjaan per request/batch; jika tetap gagal, dokumentasikan pilihan platform gratis lain atau biaya upgrade sebelum mengklaim operasi $0.

### 10.3 Modul kode yang disarankan

```text
MANDEVYR/
  PRD.md
  README.md
  package.json
  vite.config.ts
  wrangler.jsonc
  index.html
  public/
  src/
    app/                 # router, providers, app shell
    pages/               # landing, explore, dashboard, detail, trust, token
    components/          # reusable UI, verdict, evidence, charts
    features/            # mandate, preflight, watch, wallet, history
    styles/
    lib/                 # API client, formatting, chain config
    i18n/
  worker/
    index.ts             # Hono fetch + scheduled export
    routes/
    auth/
    db/
    adapters/            # Arc, vault, issuer, x402, external feeds
    domain/              # pure rules, scoring, freshness, policies
    jobs/
    observability/
  shared/
    schemas/             # Zod input/output shared browser & Worker
    types/
  migrations/
  tests/
    unit/
    integration/
    e2e/
  docs/
    architecture/
    decisions/
    runbooks/
```

Untuk mencegah ketergantungan berat, implementasi awal boleh menggunakan modul dan query SQL manual. ORM hanya ditambahkan bila migrasi/schema mulai sulit dikelola.

### 10.4 Contract boundary

- Frontend menampilkan dan meminta; backend memvalidasi ulang semua input.
- Backend tidak mempercayai `wallet_address` dari body; ia memakai sesi SIWE.
- Rules engine menerima snapshot immutable, mengembalikan verdict deterministik tanpa akses jaringan.
- Adapter mengubah format sumber menjadi model internal dengan satuan eksplisit.
- Database menyimpan identitas, observasi, laporan, dan audit; bukan private key/seed.
- Browser melakukan wallet signing. Server tidak dapat mengirim transaksi dari wallet pengguna.
- Semua panggilan pihak ketiga melewati allowlist host dan timeout.

## 11. Integrasi Arc, protokol, dan transaksi

### 11.1 Konfigurasi chain

| Lingkungan | Chain ID | RPC resmi | Explorer | Gas |
|---|---:|---|---|---|
Mainnet | 5042 | `https://rpc.mainnet.arc.io` | `https://explorer.arc.io` | USDC |
Testnet | 5042002 | `https://rpc.testnet.arc.io` | `https://explorer.testnet.arc.io` | USDC faucet |

[Sumber: Arc Connect](https://docs.arc.io/arc/references/connect-to-arc). Chain config harus dibuat dari `viem/chains` bila paket saat build sudah mendukung `arc` dan `arcTestnet`; dokumentasi Arc menyatakan keduanya tersedia. Jangan hardcode contract address token atau vault dari artikel/blog. Muat daftar resmi per environment dan verifikasi onchain saat deployment.

### 11.2 Aturan USDC Arc

Arc memakai native USDC sebagai gas dan dokumentasi jaringan menyebut 18 desimal untuk native gas. UI menampilkan **satu** saldo USDC; bila RPC/SDK mengembalikan native dan ERC-20 view yang merujuk saldo sama, deduplikasi. Untuk setiap integrasi, unit/decimals diperoleh dari kontrak atau SDK yang valid; jangan mengasumsikan angka 6 seperti implementasi USDC pada beberapa chain lain. Semua angka internal disimpan sebagai integer string/bigint + decimals + asset ID, bukan float JavaScript. [Sumber: Arc Connect](https://docs.arc.io/arc/references/connect-to-arc), [Arc EVM differences](https://docs.arc.io/arc/references/evm-differences).

### 11.3 Wallet dan sesi

Alur `connect → nonce → SIWE message → sign → verify → HttpOnly Secure SameSite cookie`. Server memeriksa domain, URI, chain ID, nonce sekali pakai, issued/expiry, signature EOA atau EIP-1271 bila didukung. Logout menghapus sesi; wallet change membatalkan sesi lama. SIWE adalah autentikasi offchain, **bukan izin transfer**. [Sumber: ERC-4361](https://eips.ethereum.org/EIPS/eip-4361).

### 11.4 Adapter kontrak

Setiap adapter mempunyai `chain_id`, kontrak, ABI versi, capability (`read_position`, `preview_deposit`, `deposit`, dll.), status `experimental/verified/disabled`, dan tanggal review. Adapter harus memverifikasi code hash/proxy implementation bila relevan dan berhenti jika target tidak cocok. Perubahan implementation pada proxy membuka review ulang.

**Adapter pertama:** satu vault ERC-4626 yang tersedia dan terverifikasi di Arc. Pilih berdasarkan dokumentasi resmi, aktivitas, metode preview, serta jalur testnet. Jangan memasukkan alamat placeholder ke konfigurasi produksi.

### 11.5 Simulasi dan receipt

Sebelum wallet prompt, jalankan `simulateContract` atau metode setara pada block terkini, hitung allowance dan gas, periksa slippage/preview. Simulasi sukses tidak menjamin transaksi akhir sukses karena state berubah; UI menyatakannya. Setelah submit, simpan tx hash dan observasi receipt; ketidakpastian RPC ditandai `unknown`, bukan otomatis gagal. Link explorer selalu menggunakan chain yang sama.

### 11.6 Bridge / swap / onramp

Arc App Kit menyediakan abstraksi bridge, swap, onramp, dan earn menurut dokumentasi; ini kandidat integrasi P3, bukan dependensi P0/P1. Setiap jalur baru perlu verifikasi biaya, dukungan chain, terms provider, dan testnet. [Sumber: dokumentasi Arc App Kit](https://docs.arc.io/app-kit).

## 12. API contract v1

Semua endpoint JSON menggunakan `/api/v1`, request ID, ISO 8601 UTC, dan `schema_version`. Mutasi wallet-scoped memerlukan sesi SIWE. Pagination cursor, batas `limit`, dan rate limit berlaku. Response error konsisten:

```json
{
  "error": {
    "code": "DATA_STALE",
    "message": "Vault status could not be refreshed.",
    "retryable": true,
    "request_id": "req_..."
  }
}
```

### 12.1 Endpoint minimum

| Method | Path | Auth | Keterangan |
|---|---|---|---|
GET | `/health` | Tidak | Status API, DB, adapter; tanpa rahasia |
GET | `/registry` | Tidak | Katalog dengan filter dan cursor |
GET | `/registry/:id` | Tidak | Detail, evidence summary, status |
GET | `/sources/:id` | Tidak | Metadata/provenance yang aman dipublikasi |
POST | `/auth/nonce` | Tidak | Nonce SIWE berumur pendek |
POST | `/auth/verify` | Tidak | Verifikasi signature; set cookie |
POST | `/auth/logout` | Ya | Invalidasi sesi |
GET | `/me` | Ya | Wallet dan preferences |
GET/POST | `/mandates` | Ya | Daftar/buat versi mandat |
GET | `/mandates/:id` | Ya | Satu versi dan rule |
POST | `/preflights` | Ya | Jalankan preflight terstruktur |
GET | `/preflights/:id` | Ya | Laporan milik wallet |
GET | `/history` | Ya | Decision timeline |
GET/POST/DELETE | `/watchlist` | Ya | Pantauan |
GET | `/alerts` | Ya | Inbox alert |
POST | `/alerts/:id/ack` | Ya | Acknowledge alert |
POST | `/actions/prepare` | Ya | P2: quote + simulasi + izin |
POST | `/actions/:id/tx` | Ya | P2: catat tx hash yang dikirim user |
GET | `/actions/:id` | Ya | P2: status receipt |
GET | `/public/methodology` | Tidak | Versi aturan dan sumber |
GET | `/token/official` | Tidak | P4: kontrak/tautan resmi, tidak ada sebelum launch |

### 12.2 Contoh request preflight

```json
{
  "schema_version": "1",
  "intent": {
    "kind": "vault_deposit",
    "chain_id": 5042002,
    "target_id": "vault_verified_001",
    "asset": "USDC",
    "amount_base_units": "50000000000000000000",
    "asset_decimals": 18
  },
  "mandate_id": "mdt_...",
  "idempotency_key": "client-generated-uuid"
}
```

### 12.3 Contoh response ringkas

```json
{
  "schema_version": "1",
  "report_id": "prf_...",
  "verdict": "REVIEW",
  "reason_codes": ["R-APY-UNVERIFIED"],
  "ruleset_version": "2026-09-30.1",
  "mandate_version": 3,
  "created_at": "2026-09-30T10:00:00Z",
  "valid_until": "2026-09-30T10:00:30Z",
  "evidence": [
    {
      "source_id": "src_...",
      "observed_at": "2026-09-30T09:59:55Z",
      "freshness": "fresh",
      "block_number": "123456"
    }
  ],
  "action_allowed": false
}
```

**Aturan API:** `action_allowed` dihitung server dari verdict, capability adapter, dan gate fase; client tidak mengirim/mengubahnya. `valid_until` dipakai hanya untuk laporan; saat aksi, quote/simulasi baru tetap diperlukan.

### 12.4 Idempotensi dan error

Endpoint mutasi finansial memakai `idempotency_key` unik per wallet/operasi, dengan hash body dan TTL. Retry dengan key sama + body sama mengembalikan hasil sama; body berbeda menghasilkan `409 IDEMPOTENCY_CONFLICT`. Kode error terpilih: `UNAUTHENTICATED`, `WRONG_CHAIN`, `UNSUPPORTED_TARGET`, `MANDATE_VIOLATION`, `DATA_STALE`, `SOURCE_DISPUTED`, `SIMULATION_FAILED`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `EXPIRED_QUOTE`, dan `PAYMENT_REQUIRED`.

## 13. Model data dan retensi

### 13.1 Tabel inti D1

| Tabel | Kolom utama | Indeks/kendala |
|---|---|---|
 `users` | wallet_address PK, created_at, locale, status | Address canonical checksum/lowercase untuk lookup |
 `sessions` | id, wallet, token_hash, expires_at, revoked_at | Unique token hash; TTL cleanup |
 `siwe_nonces` | nonce_hash, wallet_hint, expires_at, used_at | Sekali pakai |
 `registry_entities` | id, kind, chain_id, address/endpoint, provider_id, support_status, reviewed_at | Unique chain+address/kind |
 `providers` | id, name, website, trust_status, documentation_url | Review manual |
 `observations` | id, entity_id, metric, raw_value, unit, source_id, block_no, observed_at, fetched_at, ttl, hash, status | Index entity+metric+time |
 `sources` | id, type, uri, provider_id, verification_status, reviewed_at | URI unik bila tepat |
 `mandates` | id, wallet, version, rules_json, created_at, supersedes_id | Unique wallet+version |
 `preflights` | id, wallet, mandate_id, intent_json, verdict, reasons_json, evidence_refs_json, ruleset_version, valid_until, created_at, input_hash | Index wallet+created_at |
 `watchlist` | wallet, entity_id, created_at, settings_json | Unique wallet+entity |
 `alerts` | id, wallet, entity_id, rule_id, severity, old/new snapshot, created_at, read_at, dedupe_key | Unique dedupe key |
 `actions` | id, wallet, report_id, state, chain_id, target, tx_hash, created_at, updated_at | Unique chain+tx_hash jika ada |
 `api_usage` | id, wallet/client, endpoint, units, cost, payment_id, created_at | Index client+period |
 `audit_log` | id, actor, action, object_type/id, before_hash, after_hash, timestamp | Append-only aplikasi |
 `idempotency_keys` | wallet, key, request_hash, response_ref, expires_at | Unique wallet+key |

Tipe besar/nominal disimpan sebagai `TEXT` integer desimal dan dikonversi menjadi `bigint` di kode. Field JSON disertai `schema_version`. Jangan simpan seluruh response vendor bila berisi data pribadi yang tidak diperlukan.

### 13.2 Kepemilikan dan akses

Semua query atas mandat, preflight, alert, dan action harus menggunakan wallet dari sesi sebagai filter. Jangan menerima wallet dari query untuk data privat. Public registry dan metodologi dapat di-cache; history privat tidak di-cache secara shared. Admin route terpisah dengan allowlist identitas dan logging semua perubahan.

### 13.3 Retensi [P]

- SIWE nonce: sampai dipakai atau kedaluwarsa, lalu hapus ≤24 jam.
- Session: kedaluwarsa default 7 hari, dapat dicabut, bersihkan periodik.
- Raw provider payload: tidak disimpan kecuali perlu audit; maksimal 30 hari bila disimpan.
- Observasi ringkas: 90 hari detail, lalu agregasi/hapus sesuai kebutuhan produk.
- Preflight dan action history: 12 bulan default dengan ekspor dan permintaan hapus, kecuali kewajiban hukum yang valid.
- Analytics perilaku: agregat dan minimisasi identitas.

Retensi final membutuhkan peninjauan privasi dan yurisdiksi saat launch.

## 14. Agentic system dan AI

### 14.1 Definisi “agentic” untuk MANDEVYR

Agent adalah orchestrator yang menerima tujuan pengguna, memilih tool read-only, menyusun rencana, meminta preflight, lalu menyampaikan opsi. Pada MVP, agent **tidak** memiliki kemampuan melakukan transaksi sendiri. Agar tidak sekadar chatbot berlabel agent, sistem menyimpan plan, tool calls, evidence, serta hasil aturan dalam trace yang dapat ditinjau.

### 14.2 Tool registry

| Tool | Izin | Output |
|---|---|---|
 `search_registry` | Publik/read | Daftar entitas terkurasi |
 `read_entity` | Read | Detail + status sumber |
 `read_vault_state` | Read onchain | Status dan posisi yang didukung |
 `read_mandate` | Sesi wallet | Rule aktif |
 `run_preflight` | Sesi wallet | Verdict deterministik |
 `compare_options` | Read | Tabel perbandingan tanpa rekomendasi beli |
 `draft_action` | P2, sesi wallet | Draft transaksi untuk review |
 `buy_x402_resource` | P3, budget + approval | Resource dan bukti pembayaran |

Semua tool memiliki JSON schema, timeout, cost estimate, dan audit event. Tool yang mengubah state memerlukan gate yang berbeda dari tool read.

### 14.3 Model AI opsional

Mode default **tanpa LLM berbayar**: formulir intent terstruktur, engine deterministik, template penjelasan dari reason codes. Mode AI opsional memakai adapter model lokal atau BYOK yang dikonfigurasi operator, untuk mengekstrak intent dan merangkum bukti. Jika model tidak tersedia, alur inti tetap berfungsi. Tidak boleh menaruh API key AI di client.

AI output harus melewati schema validation dan pemeriksaan referensi sumber. Model tidak boleh membuat angka/APY/sumber baru. Jika AI berkata “aman” sementara verdict BLOCK/UNKNOWN, UI menampilkan verdict engine dan mencatat konflik. Prompt, respons, dan tool trace disimpan seminimal mungkin tanpa rahasia.

### 14.4 Kebijakan planning

1. Pahami tujuan user dalam intent terstruktur.
2. Jika ambigu (aset, nominal, chain), minta data spesifik sebelum preflight.
3. Ambil fakta melalui tool allowlist.
4. Jalankan rule engine, lalu susun penjelasan hanya dari field laporan.
5. Sampaikan pilihan; tindakan finansial memerlukan review wallet terpisah.

**Prompt injection boundary:** teks dari halaman/metadata token/issuer diperlakukan sebagai data tak tepercaya. Instruksi seperti “abaikan mandat” di metadata harus diabaikan. Tool output tidak boleh menaikkan izin agent. URL dan domain x402 tidak boleh berasal bebas dari respons model.

## 15. Keamanan, privasi, dan integritas

### 15.1 Threat model minimum

| Ancaman | Dampak | Kontrol |
|---|---|---|
Alamat kontrak palsu di katalog | User menandatangani transaksi ke target salah | Allowlist admin, verifikasi sumber resmi, code hash/proxy review, diff sebelum update |
Provider data salah/stale | Verdict keliru | TTL, provenance, dua sumber bila kritikal, UNKNOWN fail closed |
Prompt injection dari metadata | Agent melewati mandat | Data/tool separation, tool allowlist, rule engine otoritatif |
Wallet wrong-chain | Aksi ke chain salah | Chain ID di server & client, blok sampai switch, simulasi ulang |
Allowance tidak terbatas | Exposure wallet lebih besar | Default exact allowance bila memungkinkan; tampilkan allowance lama/baru |
Replay SIWE atau x402 | Sesi/pembayaran dipakai ulang | Nonce sekali pakai, expiry, domain binding, idempotency |
XSS/CSRF | Sesi dan tindakan terpapar | CSP, sanitasi, HttpOnly cookie, SameSite, CSRF token pada mutasi |
SSRF melalui URL issuer/API | Worker mengakses host internal atau jahat | Host allowlist, validasi URL, tidak mengikuti redirect liar |
Data wallet bocor | Profil keputusan terekspos | Query scope wallet, cache private off, minimisasi log, kontrol ekspor/hapus |
RPC outage atau reorg/receipt ambiguity | Status transaksi salah | Multi-read/timeout, unknown state, explorer link, rekonsiliasi |
Abuse API gratis | Kuota Workers/D1 habis | Rate limit, pagination, cached public routes, cost budgets |
Admin account compromise | Registry dimanipulasi | Multi-factor pada provider admin, perubahan berlog, review dua tahap untuk mainnet |
Manipulasi token/community | Kerugian reputasi/finansial | Kontrak resmi dipublikasikan, data alokasi/fee jelas, hindari klaim hasil |

### 15.2 Kontrol teknis

- Semua perubahan data privat memerlukan auth dan CSRF protection jika cookie digunakan.
- Cookie sesi `HttpOnly; Secure; SameSite=Lax/Strict` sesuai alur; tidak menyimpan token sesi di localStorage.
- Content Security Policy dan allowlist RPC/analytics; HTML dari sumber eksternal tidak di-render mentah.
- Secrets hanya via environment bindings; tidak ada `VITE_*` untuk credential rahasia. `VITE_*` hanya nilai publik seperti chain ID dan URL API.
- CORS same-origin default. Jika API publik kemudian dibuka, scope route dan rate limit eksplisit.
- Error response tidak membocorkan stack trace, secret, signed payload, atau seluruh data vendor.
- Manual review sebelum enable adapter mainnet; code review untuk perubahan ruleset dan registry.
- Data tidak diubah menjadi “verified” otomatis oleh LLM atau heuristik.
- Dependency update, lockfile, audit, dan secret scan masuk CI.
- Semua nominal memakai bigint dan fungsi format/parse yang diuji terhadap desimal Arc.

### 15.3 Privacy by design

Pengunjung publik tidak perlu wallet. Untuk akun login, simpan hanya alamat wallet dan preferensi yang diperlukan. Jangan mengumpulkan email default; email hanya untuk alert opt-in. Jangan merekam teks percakapan agent penuh bila cukup menyimpan intent terstruktur dan audit trace. Tampilkan halaman Privacy yang menjelaskan data, retensi, eksport, dan hapus. Karena riwayat onchain publik, fitur hapus hanya berlaku untuk data MANDEVYR sendiri.

### 15.4 Kill switches

Konfigurasi server mempunyai flag terpisah untuk `actions_enabled`, `x402_enabled`, `token_entitlements_enabled`, dan setiap adapter. Jika insiden: matikan aksi baru, jaga akses history/report, beri banner status, audit penyebab, dan hanya hidupkan lagi setelah gate ulang. Tidak boleh menggunakan flag client sebagai satu-satunya kontrol.

## 16. Token MANDEVYR melalui Argus

### 16.1 Hubungan produk-token

Token adalah **akses/koordinasi utilitas produk yang dapat diverifikasi** setelah ada pengguna aktif. Token tidak menjadi syarat untuk memahami risiko dasar. Nilai produk pertama adalah preflight dan monitoring; token dapat memberi kuota lebih besar atau layanan tambahan yang dibutuhkan pengguna nyata. Harga pasar token, likuiditas, dan holder rewards yang ditampilkan Argus tidak dijadikan KPI produk utama.

### 16.2 Utility yang diusulkan [P, belum aktif]

1. **Advanced report credits:** wallet yang memenuhi kriteria holder mendapatkan kuota laporan mendalam di luar kuota gratis. Kuota dan periode harus dijelaskan sebelum launch.
2. **More watch capacity:** lebih banyak target/aturan alert per akun, dengan fair-use untuk melindungi kuota infrastruktur.
3. **API access discount/credits:** potongan atau kuota untuk endpoint x402 MANDEVYR, hanya jika implementasi akuntansi dan harga sudah jelas.
4. **Beta access:** akses awal ke adapter/fitur baru yang masih aman sebagai read-only. Tidak ada akses khusus ke perdagangan yang berisiko.
5. **Product feedback voting:** masukan prioritas integrasi melalui snapshot holder, dengan mekanisme anti-sybil dasar. Ini tidak menjamin hak tata kelola treasury atau perusahaan.

Semua utilitas harus dapat dipenuhi meski harga token berubah. Detail threshold, durasi, dan token economics ditentukan setelah suplai/aturan Argus diketahui. Jangan mengiklankan utilitas yang belum dideploy sebagai aktif.

### 16.3 Entitlement design

Setelah token launch, backend membaca saldo token resmi pada Arc di block terkini atau snapshot periodik, mengikatnya ke sesi wallet, lalu menerapkan tier yang dipublikasi. Semua permintaan premium tetap memvalidasi hak pada server. Cache boleh 1–5 menit untuk UI, tetapi operasi berbiaya tinggi memerlukan cek segar. Transfer token berarti hak pada pemilik lama berakhir sesuai aturan snapshot yang diumumkan. Tidak boleh mengandalkan screenshot balance.

**Keterbatasan:** gating berbasis balance rentan sybil, pinjam token, dan pergerakan antarwallet; benefit dengan biaya signifikan mungkin memerlukan periode holding atau kredit non-transferable yang terukur. Mekanisme tersebut harus dipublikasikan dulu, bukan disisipkan setelah launch.

### 16.4 Peran Argus

Argus menjalankan proses pembuatan token dan halaman pasar token. MANDEVYR tidak mengasumsikan kendali atas kontrak, fee split, pajak, reward holder, migrasi pool, atau supply selain pilihan yang benar-benar ditawarkan Argus pada saat launch. Sebelum transaksi pembuatan token, owner harus menyimpan snapshot layar/parameter dan memeriksa kontrak, pengaturan tax, alokasi, rekening creator, serta biaya. [Sumber: Argus Docs](https://argus.world/docs).

### 16.5 Launch packet yang wajib dipublikasi

- Nama/simbol final dan pemeriksaan benturan nama/ticker.
- Alamat kontrak token resmi di Arc; link explorer dan link Argus.
- Total supply, distribusi awal, wallet tim/treasury, vesting/lock jika benar-benar ada.
- Semua buy/sell tax, pool fees, reward split, dan siapa penerimanya.
- Utility yang **sudah berjalan** serta cara pengguna memverifikasi klaim benefit.
- Risiko token: volatilitas, likuiditas, perubahan kebijakan platform, dan keterbatasan produk.
- Kebijakan penggunaan dana/fee dan laporan transparansi berkala bila ada penerimaan.
- Pernyataan hubungan MANDEVYR dengan Arc/Circle/Argus yang akurat; tidak mengklaim afiliasi tanpa izin.

**Tidak boleh:** janji return, janji listing, angka market cap target, wash trading, bot volume, imbalan untuk testimoni palsu, atau klaim “safe/guaranteed”. Persyaratan hukum penerbitan/pemasaran token dan aset finansial memerlukan review profesional menurut yurisdiksi operasi sebelum launch.

### 16.6 Gate launch token [G]

1. P1 tersedia publik dan stabil; laporan real, bukan placeholder.
2. Sekurangnya satu utility token telah siap deploy dan didemokan end-to-end di testnet.
3. Token terms dan biaya Argus telah dibaca ulang dari dokumen/UI terkini.
4. Nama dan ticker dicek lagi di merek/domain/social/token registry.
5. Kontrak dan semua wallet resmi didokumentasikan; owner multisig bila layak.
6. Security review aplikasi dan launch packet selesai.
7. Tim siap menangani insiden dan pertanyaan pengguna.
8. Founder menyetujui parameter final setelah melihat snapshot konkret.

### 16.7 KPI token yang sehat

Ukur jumlah holder yang benar-benar memakai produk, konversi holder → report/watch/API usage, retention, biaya manfaat, dan transparansi treasury. Jangan memakai harga/token volume sebagai bukti product-market fit. Pembelian token harus menjadi pilihan pengguna setelah memahami utilitas dan risiko.

## 17. Model pertumbuhan dan monetisasi

### 17.1 Akuisisi awal

1. **Public preflight pages:** contoh laporan untuk entitas publik dengan bukti, methodology, dan timestamp; mudah dibagikan tanpa mengekspos data wallet.
2. **Risk explainers:** konten singkat tentang vault preview, fees, withdraw limits, dan x402 spend budgets di Arc.
3. **Builder API:** endpoint laporan yang terdokumentasi sehingga proyek lain bisa menautkan hasilnya.
4. **Partner integration:** provider yang ingin muncul menyerahkan alamat/dokumen, tetapi tidak dapat membeli status “verified”. Sponsorship, jika ada, diberi label jelas dan terpisah dari verdict.
5. **Community feedback:** voting entitas mana yang perlu adapter berikutnya, dengan alasan dan status progress publik.

Setiap tautan ke Argus/token berada di konteks Utility/Token Hub; tidak disisipkan sebagai ajakan beli di saat pengguna sedang membaca risiko vault.

### 17.2 Pricing produk [P]

| Tier | Tujuan | Desain awal |
|---|---|---|
Guest | Menilai kualitas produk | Explore publik, laporan contoh, metodologi |
Free wallet | Aktivasi dan kebiasaan | Mandat dasar, kuota preflight mingguan, watchlist kecil |
Power user | Menutup biaya data/compute | Laporan mendalam, watchlist/alert lebih besar; bayar USDC atau benefit token bila siap |
Builder API | Integrasi | x402 per-call USDC atau paket kredit dengan batas rate |
Team | Nanti | Workspace dan audit bersama; memerlukan desain izin terpisah |

Kuota numerik dan harga tidak diputuskan sebelum data biaya per request tersedia. Akses inti tidak boleh tiba-tiba dihilangkan ketika token diluncurkan.

### 17.3 Loop produk yang diharapkan

Pengguna menemukan aset → membuat preflight → membagikan laporan publik yang disanitasi → orang lain melihat metodologi → mencoba mandat pribadi → memakai watchlist → kembali saat alert relevan. Loop ini dinilai dari penggunaan produk, bukan impresi promosi token.

## 18. Analytics dan eksperimen

### 18.1 Event dictionary

| Event | Properti aman | Pertanyaan |
|---|---|---|
 `explore_viewed` | filter, entity_kind, session_anon | Apa yang dicari? |
 `entity_opened` | entity_id, source_status | Entitas mana dipahami? |
 `wallet_connected` | chain_id, wallet_type; alamat di-hash untuk analytics | Friksi wallet? |
 `mandate_created` | template, rule_count, version | Apakah batas dipakai? |
 `preflight_started` | intent_kind, entity_kind | Intent utama? |
 `preflight_completed` | verdict, duration, reason_codes, stale_count | Keandalan engine? |
 `evidence_opened` | source_type | Apakah bukti digunakan? |
 `decision_recorded` | save/dismiss/continue | Keputusan sadar? |
 `alert_opened` | severity, rule_id, age | Alert berguna? |
 `action_submitted` | kind, chain_id, amount_bucket | Apakah review dapat dilalui? |
 `action_resolved` | confirmed/reverted/unknown, latency | Keandalan transaksi? |
 `x402_payment_completed` | endpoint, cost_bucket | Apakah API bernilai? |

Jangan merekam nominal presisi dan alamat wallet ke analytics pihak ketiga. Data detail yang diperlukan untuk laporan privat tetap di D1 dengan akses scoped.

### 18.2 Funnel

`Visit → Explore detail → Wallet connect → Mandate created → Preflight completed → Evidence opened → Decision recorded → Return within 7 days`. Setiap tahap memiliki denominator jelas dan segmentasi mobile/desktop serta source channel. Jangan menghitung bot atau refresh sebagai pengguna baru.

### 18.3 Eksperimen awal

- Apakah “Create preflight” dari detail vault lebih mudah daripada form dashboard?
- Apakah banner verdict + tiga alasan mengurangi kebingungan dibanding skor tunggal?
- Apakah template mandat meningkatkan activation tanpa membuat user memilih risiko yang salah?

Eksperimen hanya dilakukan pada copy/layout, **bukan** diam-diam mengubah rule keamanan atau batas risiko.

## 19. Anggaran dan operasi “gratis”

### 19.1 Baseline MVP

| Komponen | Biaya target saat prototipe | Batas/risiko |
|---|---|---|
Vite/React/Hono/viem | $0 lisensi open source | Waktu build dan pemeliharaan |
Cloudflare Worker + static assets | $0 dalam Free tier | 100.000 request Worker/hari; CPU 10ms/request; batas lainnya |
Cloudflare D1 | $0 dalam Free tier | 5 juta row reads/hari, 100 ribu writes/hari, 5GB storage |
Cron Trigger | Termasuk dalam batas Workers | Batas jumlah trigger, CPU, subrequest |
Arc public RPC | Tanpa biaya langganan saat memakai endpoint publik | Rate limit/uptime tidak dijamin untuk skala besar |
AI default | $0 karena rule deterministik dan template | Fitur generatif opsional membutuhkan model lokal/BYOK |
Hosting domain | Subdomain Workers dapat dipakai saat prototipe | Domain brand sendiri berbayar |
Gas, transaksi, token creation | **Bukan $0** | Pengguna/owner membayar USDC dan biaya platform terkait |
Legal/security audit profesional | **Bukan $0 bila diperlukan** | Wajib dievaluasi sebelum produk/token masuk ranah berisiko |

[Sumber: Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Workers static assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

### 19.2 Guardrails biaya

- Batasi katalog MVP (misalnya 10–20 entitas terkurasi), bukan crawling seluruh Arc.
- Cache GET publik berdasarkan TTL; dedupe RPC queries dan batch bila aman.
- Index D1 sesuai query; ukur `rows_read` dan `rows_written` per endpoint.
- Cron membagi kerja per batch kecil; sumber yang gagal masuk backoff.
- Worker mengembalikan `429/503` yang jujur saat budget habis, tidak memakai data lama seolah live.
- Dashboard internal menunjukkan requests/hari, row reads/writes, error rate, dan estimator biaya per preflight.
- Set alert saat penggunaan mencapai 70% dan 90% kuota gratis.

**Catatan operasional:** Cloudflare sejak 1 September 2026 menegakkan batas harian D1 Free; query dapat gagal sampai reset bila kuota terlewati. [Sumber: D1 changelog](https://developers.cloudflare.com/changelog/product/d1/).

## 20. Roadmap eksekusi

Estimasi di bawah untuk satu builder yang fokus; urutan dan gate lebih penting daripada tanggal. Setiap minggu menghasilkan versi yang dapat diperiksa, bukan hanya desain.

| Sprint | Output | Kriteria selesai |
|---|---|---|
S0 — Discovery & setup | Repo Vite TS, Worker/Hono, D1 local, design tokens, docs | `npm run dev`, lint/typecheck/test, deploy preview; chain config testnet |
S1 — Public shell | Landing, Explore, detail, Trust Center awal | Data fixture diberi label jelas; responsif; aksesibilitas dasar |
S2 — Live registry | Registry terkurasi, adapter read Arc, provenance | Data satu vault terbukti cocok explorer; no double USDC |
S3 — Wallet & mandate | wagmi/viem, SIWE, session, Mandate Studio | Nonce replay ditolak; mandat versioned |
S4 — Preflight core | Rules deterministik, evidence ledger, laporan | Semua hard blocks diuji; stale data → UNKNOWN |
S5 — Watchtower | Watchlist, cron poller, in-app alert | Dedupe, quota, provider outage handling |
S6 — Beta hardening | E2E, mobile, audit log, analytics, runbook | P1 public beta; 0 critical issues |
S7+ — Approved actions | Satu adapter deposit/withdraw testnet, review UI, receipts | Gate P2 lulus; mainnet disabled sampai review |
S8+ — API/token preparation | x402 pilot, utility live, token launch packet | Gate P3/P4 independen; tidak otomatis launch |

### 20.1 Urutan issue implementasi yang disarankan

1. Setup Vite React TS + Cloudflare Vite plugin + Hono, lockfile, CI.
2. Jalankan feasibility spike CPU Worker Free untuk SIWE, rules engine, dan cron.
3. Buat route shell dan komponen states standar.
4. Buat D1 migrations untuk registry/sources/observations.
5. Implementasikan adapter Arc read-only dan testnet fixture.
6. Buat public Explore/detail dengan provenance.
7. Buat SIWE dan session.
8. Buat mandat versioned dan unit tests.
9. Buat rules engine pure functions dan property tests angka/TTL.
10. Buat preflight API + UI + audit report.
11. Buat Watchtower dan Cron.
12. Instrument analytics privasi dan trust/status.
13. Lakukan beta pengguna dan perbaiki berdasarkan bukti.

### 20.2 Definition of Done setiap fitur

- Ada state loading/empty/stale/error dan copy yang jelas.
- Semua input divalidasi server; akses wallet-scoped benar.
- Nominal, chain, kontrak, dan sumber ditampilkan bila relevan.
- Unit test untuk aturan atau transformasi data yang berisiko.
- E2E untuk alur utama.
- Aksesibilitas keyboard dan mobile diperiksa.
- Telemetry dan error log tersedia tanpa rahasia.
- Dokumentasi route/schema dan perubahan PRD/ADR diperbarui.
- Feature flag dan rollback dipahami owner.

## 21. Test plan dan release criteria

### 21.1 Test pyramid

**Unit:** desimal Arc 18, bigint rounding, TTL boundary, mandat versioning, verdict precedence, idempotency, dedupe alert, sanitasi output AI. **Integration:** D1 migrations, SIWE nonce/sessions, RPC adapter dengan fixture block/contract, API access scope. **E2E:** guest explore, login, mandat, preflight PASS/REVIEW/BLOCK/UNKNOWN, wallet disconnect, wrong chain, stale provider, mobile. **Testnet:** deposit/withdraw satu adapter terverifikasi hanya setelah P2 gate.

### 21.2 Kasus yang wajib lulus

| Kasus | Ekspektasi |
|---|---|
Native USDC dan ERC-20 view sama | Satu saldo UI; bukan dua kali |
Jumlah `0.000001` dan nominal besar | Tidak kehilangan presisi |
RPC timeout | UNKNOWN, retry terukur, tidak ada CTA action |
Kontrak berubah/upgrade | Adapter disabled sampai review |
Mandat lama + preflight baru | Preflight memakai versi aktif, history lama tetap akurat |
Quote expired sebelum wallet prompt | Buat quote/simulasi baru |
User pindah chain saat review | Batal, bukan meneruskan tx |
Nonce SIWE dipakai dua kali | Request kedua ditolak |
Wallet A meminta report wallet B | 403/404, tidak bocor |
Cron dijalankan ulang | Alert tidak duplikat |
x402 retry sesudah payment | Tidak double-charge |
Source APY tidak punya metode | “Tidak diverifikasi”, bukan angka pasti |
Token metadata berisi instruksi jahat | Tidak mempengaruhi tools/rules |

### 21.3 Gate release

- **P0 public:** halaman publik memakai data yang valid atau jelas demo; identitas kontrak diverifikasi; tidak ada transaksi.
- **P1 beta:** security checklist selesai, server-side access scope diuji, 100% rule hard-stop punya unit test, error monitoring aktif.
- **P2 testnet:** satu adapter dan seluruh failure states diuji, review UI disetujui owner, receipt tracking benar.
- **P2 mainnet:** peer/security review kontrak & integrasi, kill switch, oncall/runbook, biaya gas nyata, testnet bukti.
- **P3 x402:** verifikasi protokol/provider terbaru, budget/idempotency, refund/error policy, audit pembayaran.
- **P4 token:** semua gate bagian 16.6 dan dokumen publik final.

## 22. Operasi, status, dan insiden

### 22.1 SLO awal [P]

| Area | Sasaran |
|---|---|
API read availability | ≥99% saat beta, diukur mingguan; pengecualian outage provider dilaporkan |
Preflight sukses | ≥95% untuk entitas supported saat sumber tersedia |
Freshness label | 100% metrik penting menampilkan timestamp dan status |
Critical alert detection | Sesuai interval polling yang dipublikasi; bukan real-time tanpa bukti |
Receipt resolution | Upaya cek otomatis; state `unknown` bila RPC tidak meyakinkan |

SLO ini bukan jaminan kepada pengguna; gunakan sebagai tujuan internal dan revisi setelah baseline.

### 22.2 Runbook ringkas

**RPC down:** tandai sumber stale, preflight UNKNOWN, action flag off bila simulasi gagal, banner status, coba endpoint cadangan terverifikasi. **Data conflict:** tandai disputed, freeze adapter, cek sumber resmi/block, terbitkan koreksi. **Tx state unclear:** jangan submit ulang otomatis; berikan hash explorer dan jalur cek manual. **DB quota:** turunkan polling, tampilkan degradasi, jaga akses data publik cache. **Security incident:** disable actions/x402, cabut secrets/sessions yang terdampak, audit log, beri update publik dengan timeline faktual.

### 22.3 Admin operations

Panel admin internal hanya untuk registry, status adapter, data-source review, feature flags, dan incident log. Perubahan kontrak/issuer memerlukan dua tahap persetujuan sebelum mainnet bila ada lebih dari satu maintainer. Jika solo founder, gunakan prosedur tertulis: diff sebelum/sesudah, jeda review, dan backup konfigurasi.

## 23. Risiko, dependensi, dan keputusan terbuka

### 23.1 Risk register

| Risiko | Probabilitas/dampak | Mitigasi | Owner |
|---|---|---|---|
Ekosistem Arc cepat berubah | Tinggi/sedang | Adapter modular, verifikasi docs sebelum release | Engineering |
Mainnet asset/vault yang cocok belum tersedia | Sedang/tinggi | Mulai katalog read-only/testnet; jangan inventori palsu | Product |
Kuota gratis tidak cukup | Sedang/sedang | Allowlist kecil, cache, metering, budget alert | Engineering |
AI berhalusinasi | Tinggi/tinggi bila dipakai untuk aksi | Rules deterministik, schema, no authority | Engineering |
Risiko hukum RWA/saham/token | Tinggi/tinggi | Aset research-only sampai review; counsel sebelum launch | Founder |
Argus parameter/fee berubah | Sedang/tinggi | Baca ulang saat launch, snapshot terms | Founder |
Ketergantungan provider data | Sedang/sedang | Source status, fallback, fail closed | Engineering |
Reputasi token menutupi produk | Sedang/tinggi | Utility-first, trust center, KPI penggunaan | Founder |
Security bug approval/tx | Sedang/sangat tinggi | Exact allowance, simulasi, testnet, gate mainnet | Engineering |

### 23.2 Open decisions yang harus dijawab dari bukti

1. Vault Arc mana yang dipilih sebagai adapter pertama? Butuh alamat resmi, ABI, dokumentasi, dan jalur testnet.
2. Apakah ada issuer tokenized asset di Arc yang menyediakan dokumentasi hak pemegang dan API publik cukup untuk katalog? Jangan mengasumsikan ada.
3. Provider x402/Gateway mana yang mendukung **Arc mainnet** pada saat P3, serta apa struktur biayanya? Contoh Circle yang ditemukan memakai Arc Testnet.
4. Berapa biaya rata-rata per preflight setelah 100–500 penggunaan nyata? Ini menentukan free tier/kuota.
5. Ticker token apa yang benar-benar tersedia? `MDVR` hanya ide dan **belum divalidasi**.
6. Yurisdiksi operasi/target user apa? Ini menentukan review hukum untuk token dan aset finansial.
7. Benefit token mana yang paling diminta pengguna beta? Survei/analytics sebelum threshold final.
8. Apakah perlu email alerts, atau inbox in-app cukup untuk tahap awal?

### 23.3 Decision log

| Tanggal | Keputusan | Alasan | Dampak |
|---|---|---|---|
2026-09-30 | Vite + React + TypeScript, tanpa Next.js | Instruksi founder dan SPA cukup untuk MVP | Frontend statis, API Worker |
2026-09-30 | Non-custodial dan manual approval awal | Mengurangi risiko transaksi agent | Auto-execution tidak masuk MVP |
2026-09-30 | Token melalui Argus setelah utility aktif | Token terkait layanan nyata | Launch tidak mengunci roadmap P0/P1 |
2026-09-30 | Rule engine deterministik otoritatif | AI bukan sumber kebenaran finansial | LLM opsional |

## 24. Instruksi untuk agent/koder berikutnya

Ini adalah urutan eksekusi, bukan permintaan untuk langsung mengaktifkan dana riil:

1. Baca PRD sepenuhnya, lalu baca `docs/decisions/` jika ada.
2. Jangan mengubah keputusan **Vite**, non-custodial, fail-closed, atau utility-first tanpa decision log dan persetujuan founder.
3. Buat issue kecil berdasarkan bagian 20.1, lengkapi acceptance criteria dari bagian 6–7 dan test dari bagian 21.
4. Sebelum mengintegrasikan jaringan/provider, buka dokumentasi resmi terkini dan catat tanggal, endpoint, chain ID, contract address, decimals, fee, dan versi SDK dalam ADR.
5. Mulai dari testnet serta fixture berlabel. Jangan tampilkan data mock sebagai live.
6. Setiap aksi wallet baru harus melewati preflight, simulasi, review manusia, receipt tracking, dan feature flag.
7. Jangan memasukkan private key, API key, atau seed ke repo/client/log.
8. Setelah satu fase selesai, demonstrasikan hasil dan bukti test kepada founder sebelum membuka gate berikutnya.
9. Jika fakta eksternal berubah, revisi asumsi di PRD dan catat sumbernya; jangan diam-diam membuat perilaku baru.

### 24.1 Backlog P0 yang bisa langsung diambil

| ID | Task | Acceptance |
|---|---|---|
P0-01 | Inisialisasi Vite React TS, Worker/Hono, D1 local | Dev server dan build berhasil |
P0-02 | Theme dan komponen status | Semua status verdict + data terlihat di Story/demo |
P0-03 | Chain config Arc testnet/mainnet | Chain ID/RPC/explorer sesuai referensi |
P0-04 | Registry schema + seed curated berlabel | Data demo dan live dibedakan |
P0-05 | Arc read adapter untuk satu kontrak resmi | Nilai cocok dengan explorer pada block yang sama |
P0-06 | Explore list/detail | Filter, mobile, source links, empty/error states |
P0-07 | Trust Center v0 | Metodologi dan daftar sumber terlihat publik |
P0-08 | CI lint/typecheck/unit/build | Gagal bila gate kode dasar gagal |

### 24.2 Backlog P1 yang bisa langsung diambil

| ID | Task | Acceptance |
|---|---|---|
P1-01 | SIWE nonce/session | Replay, domain mismatch, expiry ditolak |
P1-02 | Mandate schema/editor/versioning | Perubahan membuat versi baru |
P1-03 | Rules engine pure | Seluruh hard blocks diuji |
P1-04 | Evidence snapshots/TTL | Stale → UNKNOWN, sumber terbuka |
P1-05 | Preflight API/UI | Verdict dan alasan konsisten |
P1-06 | History | Akses hanya pemilik |
P1-07 | Watchlist + Cron + alerts | Dedupe dan outage handling |
P1-08 | Analytics/observability | Metrik tanpa secret/PII berlebih |
P1-09 | Beta QA | E2E utama di desktop dan mobile |

## 25. Glosarium

| Istilah | Arti di MANDEVYR |
|---|---|
Mandate | Aturan eksplisit pengguna mengenai batas risiko, nominal, dan izin |
Preflight | Pemeriksaan sebelum tindakan, menghasilkan verdict dan bukti |
Evidence | Data/sumber yang dapat ditelusuri untuk sebuah klaim |
Observation | Snapshot satu metrik pada waktu/block tertentu |
Verdict | PASS, REVIEW, BLOCK, atau UNKNOWN |
Adapter | Modul yang mengubah API/kontrak provider menjadi model internal |
Vault | Kontrak/sistem deposit yang menghasilkan share/posisi, mungkin mengikuti ERC-4626 |
RWA | Representasi onchain aset dunia nyata; haknya bergantung issuer dan dokumen |
x402 | Mekanisme pembayaran untuk akses resource HTTP 402 |
SIWE | Sign-In with Ethereum, autentikasi offchain menggunakan signature wallet |
Entitlement | Hak memakai fitur tertentu berdasarkan paket atau token setelah diterapkan |
Freshness | Umur data dibanding TTL menurut jenis metrik |
Fail closed | Jika bukti tidak cukup, sistem menolak atau menandai UNKNOWN alih-alih meloloskan aksi |

## 26. Referensi primer dan pemeliharaan PRD

Dokumen ini menggunakan sumber primer berikut. Saat mulai implementasi atau launch, cek kembali perubahan terakhir dan tulis hasilnya di ADR:

1. [Circle: Arc public mainnet launch](https://www.circle.com/pressroom/circle-launches-arc-mainnet-an-economic-operating-system-for-the-internet).
2. [Arc: Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc), [Arc: EVM differences](https://docs.arc.io/arc/references/evm-differences), [Arc: contract addresses](https://docs.arc.io/arc/references/contract-addresses).
3. [Arc: App Kit](https://docs.arc.io/app-kit) dan [Earn](https://docs.arc.io/app-kit/earn).
4. [Argus Docs](https://argus.world/docs).
5. [Circle: x402 primer](https://www.circle.com/blog/autonomous-payments-using-circle-wallets-usdc-and-x402) dan [seller API di Arc Testnet](https://www.circle.com/blog/turn-your-api-into-a-storefront-for-agents).
6. [Vite Getting Started](https://vite.dev/guide/).
7. [Cloudflare: Hono + Vite React](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/), [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).
8. [ERC-4626](https://eips.ethereum.org/EIPS/eip-4626) dan [ERC-4361 SIWE](https://eips.ethereum.org/EIPS/eip-4361).

**Aturan versi:** perubahan besar pada target pengguna, fase, token utility, security model, atau stack menaikkan versi minor/major dan mencatat alasan. Koreksi link/copy menaikkan patch. Seluruh contoh jumlah, kontrak, dan target di PRD bukan nilai produksi hingga diverifikasi.
