# E-Atık Projesi Backend Dokümantasyonu

Bu dokümantasyon, E-Atık backend uygulamasında bulunan istekleri (endpointler) ve bu isteklere gönderilmesi gereken verileri net ve sade bir şekilde açıklamaktadır.

## Temel Bilgiler

Tüm istekler ana sunucu adresinden sonrasına eklenerek gönderilir.
Örn: `http://localhost:2001/api/...`

## Geliştirme demo hesapları

Docker veya `npm run dev` ile uygulama başlarken `npx prisma db seed` otomatik çalışır (bölgeler + demo kullanıcılar). **Yalnızca geliştirme ortamı içindir** — varsayılan şifreleri production'da kullanmayın.

| Rol | E-posta | Şifre | Not |
|-----|---------|-------|-----|
| BOSS | `huseyinn.sayim@gmail.com` | `password` | Çöp kovası ekleme/düzenleme/silme (`/bin/create`, `POST/PATCH/DELETE /api/bins`) |
| USER | `user@info.com` | `password` | Son kullanıcı |
| EMPLOYEE | `employee@info.com` | `password` | Çöp toplayıcı (`TRASH_COLLECTOR`) |

Şifreyi değiştirmek için ortam değişkeni: `SEED_PASSWORD`. Production'da demo kullanıcı seed'i varsayılan olarak kapalıdır; açmak için `SEED_DEMO_USERS=true` gerekir.

Manuel seed: `npx prisma db seed`

### Yetkilendirme (Authentication)

Giriş (Login) gerektiren isteklerde, sistemin sizi tanıması için bir token iletmeniz gereklidir. Bu token iki şekilde alınarak doğrulanabilir:
1. **Header üzerinden:** İstek gönderirken Header alanında `Authorization: Bearer <token>` şeklinde.
2. **Cookie üzerinden:** `accessToken` isimli çerez (cookie) gönderilerek.

---

## 🔑 Kimlik Doğrulama (Auth) İstekleri

### 1. Kayıt Ol (Register)
Yeni bir kullanıcı oluşturmak için kullanılır.

- **URL:** `/api/auth/register`
- **Metot:** `POST`
- **Body (JSON):**
  - `name` (Zorunlu, Metin): Kullanıcı adı (En az 3, en fazla 100 karakter).
  - `email` (Zorunlu, Metin): Geçerli bir e-posta adresi (Örn: mail@example.com).
  - `password` (Zorunlu, Metin): Şifre (En az 6, en fazla 20 karakter).
  - `phoneNumber` (Zorunlu, Metin): Telefon numarası, başında '0' olmadan tam 10 karakter gönderilmelidir (Örn: "5551234567").
  - `role` (İsteğe Bağlı, Metin): Sadece `"USER"` veya `"EMPLOYEE"` olabilir. Gönderilmezse varsayılan olarak `"USER"` kabul edilir.
  - `employeeType` (İsteğe Bağlı, Metin): `"TRASH_COLLECTOR"` veya `"WASTE_COLLECTOR"` değerlerini alabilir.

### 2. Giriş Yap (Login)
Sisteme giriş yapıp token (accessToken) almak için kullanılır.

- **URL:** `/api/auth/login`
- **Metot:** `POST`
- **Body (JSON):**
  - `email` (Zorunlu, Metin): Kayıtlı e-posta adresi.
  - `password` (Zorunlu, Metin): Kullanıcı şifresi.

### 3. E-posta Doğrulama Kodu Gönder
Kullanıcının e-postasını doğrulaması için e-postasına bir doğrulama kodu gönderir.

- **URL:** `/api/auth/verify/mail`
- **Metot:** `GET`
- **Yetki:** Gerektirir (Giriş yapılmış olmalı).

### 4. E-posta Doğrula
E-postaya gelen kod ile doğrulama işlemini tamamlar.

- **URL:** `/api/auth/verify/mail/:code`
- **Metot:** `GET`
- **Yetki:** Gerektirir (Giriş yapılmış olmalı).
- **Not:** `:code` kısmı, e-postaya gelen doğrulama kodu ile değiştirilmelidir (Örn: `/api/auth/verify/mail/123456`).

### 5. Şifre Sıfırlama İstediği (Mail Gönderimi)
Şifresini unutan kullanıcılar için şifre sıfırlama linki (token taşıyan) oluşturur ve e-postaya gönderir.

- **URL:** `/api/auth/reset/password`
- **Metot:** `POST`
- **Body (JSON):**
  - `email` (Zorunlu, Metin): Şifresi sıfırlanacak hesabın e-posta adresi.

### 6. Şifre Sıfırlama Sayfasını Aç (Arayüz İçin)
E-postaya gelen şifre sıfırlama linkine tıklandığında ilgili web sayfasını açar.

- **URL:** `/api/auth/reset/password/:token`
- **Metot:** `GET`
- **Not:** Kullanıcının tarayıcıdan açacağı sayfadır.

### 7. Şifreyi Yenile
Yeni şifreyi kaydederek şifre sıfırlama işlemini tamamlar.

- **URL:** `/api/auth/reset/password/:token`
- **Metot:** `POST`
- **Body (JSON):**
  - `password` (Zorunlu, Metin): Yeni şifreniz (En az 6, en fazla 20 karakter).
- **Not:** `:token` kısmı, e-postaya gelen sıfırlama bağlantısındaki eşsiz karakter dizisidir.

### 8. Çıkış Yap (Logout)
Kullanıcının sistemden çıkış yapmasını (oturumunun ve çerezlerinin temizlenmesini) sağlar.

- **URL:** `/api/auth/logout`
- **Metot:** `GET`
- **Yetki:** Gerektirir (Giriş yapılmış olmalı).

---

## 👥 Kullanıcı (Users) İstekleri

### 1. Kullanıcıları Listele (Get Users)
Sistemdeki kullanıcıları getirir.

- **URL:** `/api/users/`
- **Metot:** `GET`
- **Yetki:** Gerektirir (Giriş yapılmış olmalı).

### 2. Kullanıcı Sil (Delete User)
Sistemdeki belirli bir kullanıcıyı silmek için kullanılır.

- **URL:** `/api/users/delete/:id`
- **Metot:** `GET`
- **Yetki:** Gerektirir (Giriş yapılmış olmalı ve 'USER' rolüne sahip olmalı).
- **Not:** `:id` kısmı silinmek istenen kullanıcının id değeridir.

---

## ⚙️ Sistem İstekleri

### 1. API Sağlık Kontrolü (Health Check)
API'nin ayakta olup olmadığını ve düzgün çalışıp çalışmadığını kontrol eder.

- **URL:** `/api-health`
- **Metot:** `GET`

---

## Çöp kovaları (Bins)

Parsel GeoJSON dosyası: `public/data/geojson/kampusParsel.geojson`. Her parselin `id` değeri (`akademik`, `hastane`, `kyk`) veritabanında `Region.region_id` ile **aynı string** olmalıdır. Üç bölgeyi otomatik oluşturmak için:

```bash
npx prisma db seed
```

### Doluluk oranı (`predictedFullness`)

Hesaplanan alandır; manuel PATCH ile güncellenmez.

- **Referans:** 100 litre tam dolana kadar geçen süre — konteyner (`CONTAINER_SMALL`, `CONTAINER_LARGE`): **24 saat**; atık noktası (`WASTE_POINT`): **48 saat**.
- **Formül:** `hoursToFull = (capacityVolume / 100) × baseHours`; `predictedFullness = min(1, elapsedHours / hoursToFull)`.
- **Son boşaltma:** En son `CollectionLog.emptiedAt`; kayıt yoksa `Bin.createdAt` (yeni kova boş kabul edilir).
- `GET /api/bins` ve `GET /api/bins/:id` her istekte doluluğu hesaplar ve `Bin.predictedFullness` alanına yazar.

### 1. Çöp kovalarını listele

- **URL:** `/api/bins`
- **Metot:** `GET`
- **Yetki:** Gerekmez.
- **Sorgu (isteğe bağlı):** `regionId` — bölgenin Prisma UUID değeri (`Region.id`).
- Yanıtta `predictedFullness`, `lastEmptiedAt`, `hoursToFull` (hesaplanmış).

### 2. Tek çöp kovası

- **URL:** `/api/bins/:id`
- **Metot:** `GET`
- **Yetki:** Gerekmez.

### 3. Yeni çöp kovası oluştur

- **URL:** `/api/bins` veya `/api/bins/create`
- **Metot:** `POST`
- **Yetki:** Giriş + rol `ADMIN` veya `BOSS`. Cookie (`accessToken`) veya `Authorization: Bearer ...`.
- **Body (JSON):**
  - `latitude` (zorunlu, sayı)
  - `longitude` (zorunlu, sayı)
  - `wasteCategory`: `DOMESTIC` | `ELECTRONIC` | `PLASTIC` | `GLASS` | `PAPER` | `GENERAL`
  - `type`: `CONTAINER_LARGE` | `CONTAINER_SMALL` | `WASTE_POINT`
  - `capacityVolume` (zorunlu, pozitif sayı, litre)
  - `regionId` (zorunlu, metin): Parsel anahtarı — GeoJSON `feature.id` ile aynı (`akademik`, `hastane`, `kyk`).

Sunucu, noktanın seçilen parsel poligonu içinde olduğunu doğrular; aksi halde `400` döner.

### 4. Çöp kovasını güncelle

- **URL:** `/api/bins/:id`
- **Metot:** `PATCH`
- **Yetki:** Giriş + `ADMIN` veya `BOSS`.
- **Body:** En az bir alan; tümü isteğe bağlı: `latitude`, `longitude`, `wasteCategory`, `type`, `capacityVolume`, `regionId` (parsel anahtarı — bölge değişiminde).

### 5. Kovayı boşalt (CollectionLog)

- **URL:** `/api/bins/:id/collect`
- **Metot:** `POST`
- **Yetki:** Giriş + rol `EMPLOYEE`, `ADMIN` veya `BOSS`.
- **Body:** Boş JSON `{}` yeterli.
- Anlık doluluk `CollectionLog.actualFullness` olarak kaydedilir; `predictedFullness` sıfırlanır.

### Geri dönüşüm istatistikleri

Dashboard ve API, kategori bazında toplanan atık hacmini (litre) gösterir.

- **URL:** `GET /api/stats/recycling`
- **Yetki:** Giriş gerekir (`isAuth` — cookie veya Bearer).
- **Yanıt:** `data` dizisi: `key`, `label` (Türkçe), `liters`, `formatted`, `iconUrl`.

**Hesaplama (v1):** Her `CollectionLog` kaydı için `collectedLiters = actualFullness × Bin.capacityVolume`; kategori `Bin.wasteCategory` üzerinden toplanır. Kayıt yoksa tüm kategoriler `0 L`.

**İleride:** `WasteRequest` (`status = COLLECTED`, `weight` dolu) aynı servise eklenecek.

---

### 6. Çöp kovasını sil

- **URL:** `/api/bins/:id`
- **Metot:** `DELETE`
- **Yetki:** Giriş + `ADMIN` veya `BOSS`.

### Web arayüzü

#### Tanıtım sayfası (herkese açık)

- **URL:** `/` — giriş gerekmez; hakkımızda, özellikler, vizyon ve misyon bölümleri.
- Yönetim paneli: **`/dashboard`** (giriş zorunlu).

#### Rol bazlı sayfalar

| Rol | Sayfalar |
|-----|----------|
| **USER** | `/dashboard` (geri dönüşüm özeti + kampüs haritası, yönetim sayfaları yok), `/user/my-recycling` (kişisel geri dönüşüm taslağı) |
| **ADMIN** | Yukarıdakilere ek `/admin/employee-tracking` (canlı çalışan konumu) |
| **BOSS / EMPLOYEE** | `/dashboard` (tam dashboard + harita), `/bin/create`, `/region/create` |
| **EMPLOYEE** | Ayrıca `/employee/work-region`, `/employee/my-route` (rota taslağı); dashboard üstünde bölge doluluk uyarıları (%80+) |

### Çalışan doluluk uyarıları

- **EMPLOYEE** panelde (`/dashboard`), atanmış çalışma bölgesindeki kovalar için `predictedFullness >= 0.8` ise üstte kırmızı uyarı listesi gösterilir.
- Bölge seçilmemişse sarı uyarı ve `/employee/work-region` linki.
- Hesaplama: [`services/employeeRegionAlerts.js`](services/employeeRegionAlerts.js) — okuma modunda doluluk enrich (DB sync yok).

Yetkisiz sayfa istekleri `requirePageRole` ile panele (`/dashboard`) yönlendirilir.

- **URL:** `/bin/create` (giriş + ADMIN, BOSS veya EMPLOYEE)
- Haritada mevcut kutular, tıklayınca düzenleme/silme; yeni ekleme için parsel içine tıklama.

### Konum takibi (Socket.io)

Çalışan konumları bellekte tutulur (sunucu restart’ta sıfırlanır). Bağlantıda JWT zorunlu: `auth: { token: '<accessToken>' }`.

| Yön | Event | Payload |
|-----|--------|---------|
| Client → Server | `location:update` | `{ latitude, longitude, accuracy? }` (yalnızca **EMPLOYEE**) |
| Server → ADMIN | `location:employee:update` | `{ userId, name, latitude, longitude, updatedAt }` |
| Server → ADMIN | `location:employees:snapshot` | `{ employees: [...] }` |

- **REST:** `GET /api/tracking/employees` — **ADMIN**; bellekteki son konumlar.
- Kampüs dışı konum güncellemesi reddedilir.

### Atık talepleri (USER konumu)

| Endpoint | Metot | Yetki |
|----------|-------|-------|
| `/api/waste-requests` | POST | USER — `wasteType`, `latitude`, `longitude`, `note?` |
| `/api/waste-requests/mine` | GET | USER |
| `/api/waste-requests` | GET | ADMIN |
| `/api/waste-requests/:id` | PATCH | ADMIN — `status`, `assignedEmployeeId?` |

Konum `assertPointInCampus` ile doğrulanır (kampüs parsellerinden biri içinde olmalı).

**Demo hesap (ADMIN):** `admin@info.com` / `password` (seed).
