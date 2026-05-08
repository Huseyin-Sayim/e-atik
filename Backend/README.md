# E-Atık Projesi Backend Dokümantasyonu

Bu dokümantasyon, E-Atık backend uygulamasında bulunan istekleri (endpointler) ve bu isteklere gönderilmesi gereken verileri net ve sade bir şekilde açıklamaktadır.

## Temel Bilgiler

Tüm istekler ana sunucu adresinden sonrasına eklenerek gönderilir.
Örn: `http://localhost:2001/api/...`

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
