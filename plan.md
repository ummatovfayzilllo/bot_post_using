# 🤖 Bot Post Using — Loyiha Arxitekturasi va Ish Rejasi (Specification & Plan)

## 📌 1. Loyiha Haqida (Project Overview)
**bot_post_using** — Telegram kanallari va guruhlariga e'lonlar va postlarni **darhol (instant)** yoki belgilangan **muddat (scheduled deadline)** bo'yicha avtomatik yuboruvchi NestJS asosidagi Telegram Bot va REST API tizimi.

Loyiha sodda foydalanuvchilar uchun intuitiv va tushunarli Inline tugmalar bilan boshqariladi, kelajakda esa Frontend Web App (Dashboard) integratsiyasi uchun to'liq REST API endpointlar bilan ta'minlanadi.

---

## 🎯 2. Asosiy Funksional Talablar (Functional Requirements)

### 2.1. Foydalanuvchi Ruxsati va Xavfsizlik (Access Control)
- **Ruxsat etilgan Adminlar (Allowed Users):** Boshlanishiga faqat `.env` da belgilangan `ALLOWED_USER_IDS` ro'yxatidagi foydalanuvchilargina botdan foydalanishi va e'lon qo'shishi mumkin.
- Begona foydalanuvchilarga xavfsizlik filtri orqali ruxsat berilmaydi.

### 2.2. E'lonlarni Boshqarish (Posts Management)
- **/new_post:** Yangi e'lon yaratish jarayoni:
  - Post matni / media (rasm, video) qabul qilish.
  - Maqsadli kanal va guruhlarni tanlash (`[ Chat nomi ]  ✅ / ❌`).
  - Yuborish turi: **Darhol yuborish** yoki **Deadline (Rejalashtirilgan vaqt)** belgilash.
- **/posts:** E'lonlar ro'yxatini boshqarish menyusi:
  - **Kutilayotgan (Scheduled / Pending):** Belgilangan vaqtni kutayotgan postlar.
  - **Arxiv (Sent / Archived):** Yuborilgan postlar tarixi.
- **Post tafsilotlari (Post Detail View):**
  - Yaratilgan vaqti va kim tomonidan yaratilgani.
  - Post holati (*Yuborilgan*, *Kutilayotgan*, *Xatolik*).
  - Alohida blokda e'lonning to'liq ko'rinishi (Preview).
  - **Amallar (Action Buttons):** `✏️ Tahrirlash`, `🗑 O'chirish`, `⚡️ Darhol yuborish`.

### 2.3. Kanal va Guruhlarni Boshqarish (Channels & Groups)
- Admin tomonidan kanallar va guruhlarni qo'shish:
  - `ID`, `username` yoki `link` orqali qo'shish imkoni.
- **Avtomatik Tekshiruv (Health Check):**
  - Bot kanal/guruhga qo'shilganmi va unda post joylash uchun yetarli **Admin huquqi** bormi?
  - Tekshiruv natijasi bo'yicha aniq va tushunarli xabar qaytarish (`✅ Bot kanalda admin` yoki `❌ Botga admin huquqi berilmagan`).

---

## 🏗 3. Dasturchi Qoidalari va Arxitektura (Developer Standards)

### 3.1. Kod Yozish Standartlari (Clean Code & Simplicity)
1. **Soddalik:** Murakkab ternar operatorlar (`a ? b : c ? d : e`) taqiqlanadi. Faqat oddiy va o'qilishi oson `if / else` yoki `switch` ishlatiladi.
2. **Xatoliklarni ushlash:** Xatolik chiqishi mumkin bo'lgan har qanday asinxron va xavfli bloklarda qat'iy `try / catch` qo'llaniladi.
3. **DRY Prinsipi:** Callback funksiyalar va xabarlar takrorlanmasligi uchun alohida modullarga ajratiladi.

### 3.2. Loyiha Papkalar Strukturasi (Folder Structure)

```
src/
├── common/
│   ├── config/                     # Konfiguratsiya sozlamalari (env, bot, database)
│   ├── types/                      # Guruhlangan TypeScript turlari
│   │   └── [group_name]/index.ts   # Misol: types/post/index.ts, types/channel/index.ts
│   └── utils/
│       ├── _cb_functions/          # Qayta ishlatiluvchi callback funksiyalar (DRY)
│       └── _message_generator/     # Telegram xabarlarini formatlash va shablonlar
├── core/
│   ├── core.module.ts              # Umumiy xizmatlar (Prisma, Cache, File, BotConnector)
│   └── initialition.ts             # Bootstrap ilova sozlamalarini yig'uvchi yagona funksiya
├── global/
│   ├── logger/                     # Tizim loglari va monitoring
│   ├── errorhandler/               # Global xatoliklarni ushlovchi filterlar (Exceptions)
│   └── user_filter/                # Ruxsat etilgan foydalanuvchilarni tekshiruvchi guard/filter
└── modules/
    ├── admin/                      # Admin boshqaruvi
    ├── channels/                   # Kanallar boshqaruvi va REST API
    ├── groups/                     # Guruhlar boshqaruvi va REST API
    └── posts/                      # Postlar, cron/scheduler va REST API
```

---

## 📋 4. Bosqichma-bosqich Bajarish Yo'l Xaritasi (Roadmap)

- [ ] **1-Bosqich: Loyiha Asosi (Core & Config):** Papkalar strukturasini ochish, `initialition.ts`, `core.module.ts` va `ConfigModule` ni sozlash.
- [ ] **2-Bosqich: Global Xavfsizlik & Bot Ulanishi:** `user_filter` (Allowed Users), Bot Connector va Telegram bilan ulanishni yo'lga qo'yish.
- [ ] **3-Bosqich: Kanallar va Guruhlar Moduli:** Kanal qo'shish, bot admin huquqini avtomatik tekshirish mexanizmi.
- [ ] **4-Bosqich: Postlar va E'lonlar Moduli:** `/new_post`, `/posts`, Inline tugmalar orqali maqsadli kanallarni tanlash.
- [ ] **5-Bosqich: Scheduler & Deadline:** Rejalashtirilgan vaqtda (Cron / Timeout) postlarni yuborish va arxivlash.
- [ ] **6-Bosqich: REST API Endpoints:** Kelajakdagi Web App uchun kontrollerlar va Swagger hujjatlarini ulash.
