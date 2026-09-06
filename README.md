# 🤖 Bot Post Using — Aqlli Telegram E'lon va Post Boshqaruv Tizimi

<p align="center">
  <b>NestJS + Telegraf + PostgreSQL (Prisma) + MongoDB Atlas + Redis (BullMQ) + Antigravity AI</b>
</p>

---

## 📌 Loyiha Haqida

**Bot Post Using** — Telegram kanallari va guruhlariga e'lonlar, xabarlar va media fayllarni avtomatlashtirilgan holda, reja (deadline) asosida yuboruvchi hamda AI yordamida postlarni professional SMM formatiga keltiruvchi ilg'or bot tizimi.

Tizim korporativ talablarga mos ravishda **gibrid ma'lumotlar bazasi** (PostgreSQL asosiy boshqaruv uchun + MongoDB Atlas audit va arxiv backup uchun + Redis state/queue kesh uchun) asosida qurilgan.

---

## ✨ Asosiy Imkoniyatlar va Arxitektura

### 1. 🧠 AI SMM Formatlash & Intent Klassifikatsiyasi
- Foydalanuvchi yuborgan xom matn AI (`agy -p` / Gemini) orqali avtomatik tahlil qilinadi.
- Xabar turiga qarab (`POST` yoki `CHAT`) ajratiladi:
  - **E'lon bo'lsa:** Xavfsiz Telegram HTML teglar (`<b>`, `<i>`, `<code>`) va mos emojilar bilan formatlanadi.
  - **Savol/Yordam bo'lsa:** Botning real-time holati (ulangan kanallar/guruhlar) asosida javob beradi.
- **Fail-safe / Graceful fallback:** AI xizmati bilan aloqa uzilsa, xabar qulab tushmaydi va asl xom matn xavfsiz saqlanadi.

### 2. 🛡 Bot Health Check va Huquqlarni Qat'iy Tekshirish
- **Kanallar:** Botning kanalda `administrator` yoki `creator` ekanligi hamda `can_post_messages` huquqi qat'iy tekshiriladi.
- **Guruhlar:** Bot guruhdan chiqarilmaganligi (`status !== 'left' && status !== 'kicked'`) va xabar yozish huquqi (`can_send_messages !== false`) tekshiriladi, bu esa `403 Forbidden` xatolarini 100% oldini oladi.

### 3. 📄 Postlar Pagination & Dinamik Breadcrumb Tizimi
- E'lonlar ro'yxati **10 tadan sahifalash (Pagination)** orqali boshqariladi (`⬅️ Oldingi`, `📄 page/totalPages`, `Keyingi ➡️`).
- Har bir sahifa va wizard bosqichlarida dinamik navigatsiya izi ko'rsatiladi (`📍 Bosh menyu ❯ 📋 E'lonlar ❯ 📁 Arxiv (1-sahifa)`).

### 4. ✏️ Inline Switch Jonli Tahrirlash
- Telegramning `switchToCurrentChat` qalamcha tugmasi orqali post matni tahrirlanganda bot `EDITING_EXISTING_POST` holatida qoladi.
- Arxivdagi xabarlar tahrirlanganda, ulangan barcha kanallardagi xabarlar real-vaqtda jonli tahrirlanadi (`telegram.editMessageText`).

### 5. ⚙️ Telegraf Regex Xavfsizligi
- Barcha action handlerlariga satr boshi langarlari (`^`) qo'yilgan (`/^ai_reformat:(.+)/`, `/^apply_ai_reformat:(.+)/`), bu esa callback to'qnashuvlarini (collision) butunlay bartaraf etadi.

### 6. 🕒 BullMQ Delayed Queue Scheduler
- Postlarni darhol yuborish yoki aniq belgilangan vaqtga (masalan, `14:30`, `+10m`, `+1h`, `2026-09-06 18:00`) rejalashtirish imkoniyati.

---

## 🗂 Bot Buyruqlari

| Buyruq | Tavsifi |
| :--- | :--- |
| `/start` | Botni ishga tushirish va asosiy menyuni ochish |
| `/new_post` | Yangi e'lon yaratish wizardini boshlash (Matn, Rasm, Video yoki Ovozli xabar orqali) |
| `/posts` | Kutilayotgan (rejalashtirilgan) va arxivdagi postlarni ko'rish, tahrirlash, darhol yuborish yoki o'chirish |
| `/channels` | Ulangan kanallar ro'yxati, yangi kanal qo'shish va admin huquqini tekshirish |
| `/groups` | Ulangan guruhlar ro'yxati, yangi guruh qo'shish va huquq tekshiruvi |
| `/cancel` | Har qanday faol jarayon va holatni bekor qilish |

---

## 🛠 Texnologiyalar Steki

- **Backend Framework:** [NestJS](https://nestjs.com/) (TypeScript)
- **Telegram Bot Framework:** [nestjs-telegraf](https://github.com/bukis/nestjs-telegraf) & [Telegraf.js](https://telegraf.js.org/)
- **Asosiy Ma'lumotlar Bazasi:** PostgreSQL + [Prisma ORM](https://www.prisma.io/)
- **Audit & Backup Bazasi:** MongoDB Atlas + [Mongoose](https://mongoosejs.com/)
- **Kesh & Navbat:** Redis + [BullMQ](https://docs.bullmq.io/)
- **AI Integratsiyasi:** Antigravity CLI (`agy -p` / Gemini Vision & NLP)
- **Audio Transkripsiya:** Whisper / Python STT skriptlari

---

## 🚀 O'rnatish va Ishga Tushirish

### 1. Repozitoriyani klonlash va bog'liqliklarni o'rnatish:
```bash
git clone https://github.com/ummatovfayzillo/bot_post_using.git
cd bot_post_using
npm install
```

### 2. Muhit o'zgaruvchilarini sozlash (`.env`):
`.env.example` faylidan nusxa olib `.env` faylini yarating va quyidagi parametrlarni kiriting:
```env
PORT=3000
NODE_ENV=development

# Telegram Bot
BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN"
ALLOWED_USER_IDS="7463402937,6455909710"

# Primary Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/bot_post_db?schema=public"

# Backup Database (MongoDB Atlas)
MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/bot_post_backup_db?retryWrites=true&w=majority"

# Redis (State & BullMQ Queue)
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""
```

### 3. Prisma Migratsiyalarini yuklash:
```bash
npx prisma generate
npx prisma db push
```

### 4. Loyihani ishga tushirish:
```bash
# Rivojlanish rejimi (watch mode)
npm run start:dev

# Ishlab chiqarish uchun build va start
npm run build
npm run start:prod
```

---

## 📄 Litsenziya

Ushbu loyiha xususiy mulk hisoblanadi va barcha huquqlar himoyalangan.
