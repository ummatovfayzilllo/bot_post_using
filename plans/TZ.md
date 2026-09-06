# 📋 Texnik Topshiriq (TZ) — "bot_post_using"

## 1. Loyiha Maqsadi va Rivojlanish Bosqichlari
**bot_post_using** — Telegram kanallari va guruhlariga e'lonlar va xabarlarni **darhol (instant)** yoki belgilangan **rejalashtirilgan vaqtda (scheduled / deadline)** avtomatik yuboruvchi NestJS asosidagi Telegram Bot va REST API tizimi.

Loyiha ikki aniq bosqichda amalga oshiriladi:
1. **V1 (Telegram Bot MVP):** Barcha boshqaruv to'liq Telegram bot interfeysi (buyruqlar, inline tugmalar, wizard) orqali ishlaydi. Servislar esa kelajakda Web App uchun tayyor holatda, ajratilgan va toza arxitekturada yoziladi.
2. **V2 (Web App Integratsiyasi):** Mavjud servislar ustiga REST API kontrollerlar, TMA (`initData`) validatsiyasi va Swagger hujjati ulanadi.

---

## 2. Texnologiyalar Stoki (Tech Stack)
- **Backend Asosi:** NestJS (TypeScript, Node.js)
- **Telegram Bot Framework:** `nestjs-telegraf` / `telegraf`
- **Asosiy Relatsion DB:** PostgreSQL (Prisma ORM)
- **Zaxira (Backup) & Audit DB:** MongoDB (Mongoose ODM)
- **Kesh & Navbat:** Redis (BullMQ va Kesh qatlami)
- **State Boshqaruvi:** In-memory `Map` (Primary Session State) + Redis (tiklanuvchi kesh) + MongoDB (draftlar va to'liq audit zaxirasi)
- **Navbat & Scheduler:** BullMQ + `MessageQueueService` (`src/core/message_queue.service.ts`), agar Redis bo'sh bo'lsa yoki server qayta yoqilsa MongoDB/Postgres'dan avtomatik navbatni tiklash mexanizmi
- **Kelajakdagi REST API & Hujjatlash:** NestJS Controllers + TMA (initData) validatsiyasi + Swagger UI (`@nestjs/swagger`)

---

## 3. Asosiy Funksional Talablar (V1 Telegram Bot)

### 3.1. Ruxsat va Xavfsizlik (Access Control)
- **Allowed Users:** `.env` dagi `ALLOWED_USER_IDS` ro'yxatida bo'lgan Telegram user ID larigina botdan to'liq foydalana oladi. Begona foydalanuvchilar global `UserFilterGuard` orqali to'xtatiladi.

### 3.2. Kanal va Guruhlarni Boshqarish (Channels & Groups)
- Admin tomonidan kanallar/guruhlarni qo'shish:
  - `ID` (masalan, `-1001234567890`), `@username` yoki `link` orqali.
- **Avtomatik Tekshiruv (Health Check):**
  - Bot kanalga/guruhga qo'shilganmi?
  - Botda post joylash uchun yetarli admin ruxsati bormi (`can_post_messages` kanallar uchun, `can_send_messages` guruhlar uchun)?
  - Tekshiruv natijasi bo'yicha aniq xabar: `✅ Bot kanalda admin` yoki `❌ Botga admin huquqi berilmagan`.

### 3.3. E'lonlar va Postlarni Boshqarish (Posts Management)
- **/new_post:** Yangi post yaratish jarayoni:
  1. Post matni, rasmi, videosi yoki hujjati qabul qilinadi (Telegram `file_id` saqlanadi).
  2. Maqsadli kanal/guruhlar tanlanadi (`[ Kanal Nomi ] ✅ / ❌` inline tugmalar bilan).
  3. Yuborish turi tanlanadi: **⚡️ Darhol yuborish** yoki **⏰ Rejalashtirilgan vaqt (Deadline)** kiritish.
- **/posts:** E'lonlar boshqaruv paneli:
  - **Kutilayotgan (Scheduled):** Hali yuborilmagan postlar ro'yxati.
  - **Arxiv (Sent):** Yuborilgan postlar tarixi.
  - **Post Ko'rish va Amallar:** Post prevyusi, yaratilgan vaqti, holati (`SENT`, `SCHEDULED`, `FAILED`), tahrirlash, o'chirish, darhol yuborish tugmalari.

### 3.4. State va Backup Tizimi
- **Foydalanuvchi qadamlari (Wizard/Step):** Tezkor In-Memory `Map` da boshqariladi.
- **Redis Sync:** Har bir qadam holati Redis'ga yoziladi (sessiya tiklanishi uchun).
- **MongoDB Backup:** Har bir postning xom ko'rinishi (raw payload, media file_id, tanlangan kanallar, audit log) MongoDB'dagi tegishli schemaga zaxira sifatida saqlanadi.
- **PostgreSQL Relatsion DB:** Kanallar, guruhlar, adminlar va asosiy post jadvallari saqlanadi.

---

## 4. Dasturchi Qoidalari va Arxitektura Standartlari
1. **Soddalik:** Murakkab ternar operatorlar taqiqlanadi. Faqat `if / else` va `switch` ishlatiladi.
2. **Xatoliklarni ushlash:** Har qanday asinxron amalda to'liq `try / catch` qo'llaniladi.
3. **DRY:** Callbacklar `src/common/utils/_cb_functions/` va xabar shablonlari `src/common/utils/_message_generator/` papkalarida yig'iladi.
4. **Papkalar Strukturasi:**
```
src/
├── common/
│   ├── config/                     # Konfiguratsiya (env, telegram, redis, db)
│   ├── types/                      # TypeScript tiplari (post, channel, backup va h.k.)
│   └── utils/
│       ├── _cb_functions/          # Qayta ishlatiluvchi callbacklar
│       └── _message_generator/     # Telegram xabarlari generatorlari
├── core/
│   ├── core.module.ts              # Asosiy servislar (Prisma, Mongoose, Redis, MessageQueue, BotConnector)
│   ├── initialition.ts             # App bootstrap va sozlamalar
│   ├── prisma.service.ts           # PostgreSQL ulanishi
│   ├── mongoose.service.ts         # MongoDB ulanishi va schemalar
│   ├── redis.service.ts            # Redis ulanishi
│   └── message_queue.service.ts    # BullMQ + Fallback Queue controller
├── global/
│   ├── logger/                     # Loglar tizimi
│   ├── errorhandler/               # Global exception filterlar
│   └── user_filter/                # Allowed users guard
└── modules/
    ├── admin/                      # Admin boshqaruvi va handlerlar
    ├── channels/                   # Kanallar boshqaruvi (V1: Bot handler / Service, V2: Controller)
    ├── groups/                     # Guruhlar boshqaruvi (V1: Bot handler / Service, V2: Controller)
    └── posts/                      # Postlar boshqaruvi (V1: Bot handler / Service, V2: Controller)
```
