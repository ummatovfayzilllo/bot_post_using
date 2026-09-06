# 🚀 Amalga Oshirish Rejasi (Implementation Plan) — "bot_post_using"

Ushbu reja loyihani 2 ta yirik bosqichga (V1: Telegram Bot MVP va V2: Web App Integratsiyasi) ajratgan holda amalga oshiriladi.

---

## 🏛 1-QISM: V1 — Telegram Bot MVP (To'liq Bot orqali Boshqaruv)
> **Maqsad:** Loyihani to'liq Telegram bot interfeysi orqali ishga tushirish. Barcha servislar (DB, Queue, State) kelajakda Web App ulanishiga mos toza va modulli arxitekturada quriladi.

### 1-Bosqich: Atrof-muhit va Kutubxonalar (Dependencies & Config)
- [x] Kerakli kutubxonalarni o'rnatish:
  - `telegraf`, `nestjs-telegraf`
  - `@prisma/client`, `prisma`
  - `mongoose`, `@nestjs/mongoose`
  - `ioredis`, `bullmq`, `@nestjs/bullmq`
  - `@nestjs/config`, `class-validator`, `class-transformer`
- [x] `.env` va `src/common/config/` konfiguratsiya modullarini yaratish.
- [x] `src/core/initialition.ts` va `src/main.ts` ni sozlash.

### 2-Bosqich: Ma'lumotlar Bazalari va Sxemalar (Postgres, Mongo, Redis)
- [x] **Prisma (PostgreSQL) sxemasi:**
  - `User` (adminlar)
  - `Channel` (kanallar va bot huquqlari)
  - `Group` (guruhlar va bot huquqlari)
  - `Post` (e'lon matni, media file_id, yuborish vaqti, statusi)
  - `PostTarget` (qaysi kanal/guruhga yuborilgani)
- [x] **Mongoose (MongoDB sxemasi):**
  - `PostBackupSchema` (xom post ma'lumotlari, audit log va zaxira)
  - `StateBackupSchema` (avariya holatida sessiyalarni tiklash zaxirasi)
- [x] `PrismaService`, `MongooseService`, `RedisService` larni `src/core/` da ulash.

### 3-Bosqich: State Boshqaruvi va Navbat Tizimi (State & Message Queue)
- [x] `src/core/state.service.ts`:
  - Primary: In-Memory `Map` (tezkor bot sessiyasi)
  - Rehydratable: Redis kesh (qayta tiklash uchun)
  - Fallback: MongoDB'dan tiklash
- [x] `src/core/message_queue.service.ts`:
  - BullMQ orqali rejalashtirilgan (deadline) postlarni boshqarish
  - Failover: Redis bo'sh bo'lsa yoki restart bo'lsa, PostgreSQL/MongoDB'dan kutilayotgan postlarni qayta navbatga yuklash

### 4-Bosqich: Global Xavfsizlik va Bot Ulanishi (Security & Bot Core)
- [x] `src/global/user_filter/user_filter.guard.ts` (`ALLOWED_USER_IDS` tekshiruvi)
- [x] `src/global/errorhandler/` va `src/global/logger/` modullari
- [x] `src/core/bot_connector.service.ts` orqali botni ishga tushirish

### 5-Bosqich: Kanallar va Guruhlarni Boshqarish (Bot Interface)
- [x] Admin tomonidan kanal/guruh qo'shish (ID, @username, link orqali)
- [x] Avtomatik Health Check (`getChatMember` orqali bot adminligini tekshirish)
- [x] Kanallar va guruhlar ro'yxati menyusi

### 6-Bosqich: Postlar Moduli va Telegram UI (Wizard & Scheduler)
- [x] `/new_post` komandasi va inline wizard:
  - Matn va media (rasm/video) qabul qilish
  - Inline tugmalar orqali maqsadli chatlarni tanlash (`✅ / ❌`)
  - Darhol yuborish yoki Deadline (vaqt) belgilash
- [x] `/posts` komandasi:
  - Kutilayotgan va arxiv postlar ro'yxati
  - Post tafsilotlari (Preview, yaratilgan vaqti, holati)
  - Amallar: `✏️ Tahrirlash`, `🗑 O'chirish`, `⚡️ Darhol yuborish`
- [x] Loyihani to'liq kompilatsiya (build) qilish va sinovdan o'tkazish.

---

## 🌐 2-QISM: V2 — Web App / Dashboard Integratsiyasi (Keyingi Bosqich)
> **Maqsad:** Mavjud biznes servislar ustiga REST API va Telegram Web App interfeysini ulash.

### 7-Bosqich: REST API Endpoints va Hujjatlash
- [ ] `@nestjs/swagger` o'rnatish va API hujjatlarini yaratish
- [ ] `ChannelsController`, `GroupsController`, `PostsController`, `AdminController` larni ochish
- [ ] Mavjud `ChannelsService`, `PostsService` va boshqa biznes logikalarni kontrollerlarga ulash

### 8-Bosqich: TMA (Telegram Mini App) Auth & Xavfsizlik
- [ ] Telegram WebApp `initData` validatsiya guardini yaratish
- [ ] Web App foydalanuvchisi huquqlarini tekshirish
- [ ] Frontend bilan to'liq integratsiya va yakuniy topshirish
