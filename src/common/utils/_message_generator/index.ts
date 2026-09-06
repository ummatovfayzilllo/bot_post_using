import { BotWizardStep, TargetItem } from 'src/common/types';

export class MessageGenerator {
  static welcomeMessage(userName: string): string {
    return (
      `👋 Assalomu alaykum, <b>${userName}</b>!\n\n` +
      `🤖 <b>Bot Post Using</b> — e'lon va xabarlarni kanallar hamda guruhlarga avtomatlashtirilgan holda yuborish tizimiga xush kelibsiz.\n\n` +
      `📌 <b>Mavjud buyruqlar:</b>\n` +
      `▫️ /new_post — Yangi e'lon yaratish\n` +
      `▫️ /posts — E'lonlar ro'yxati va boshqaruvi\n` +
      `▫️ /channels — Kanallar ro'yxati va sozlash\n` +
      `▫️ /groups — Guruhlar ro'yxati va sozlash\n` +
      `▫️ /cancel — Joriy amalni bekor qilish`
    );
  }

  static accessDeniedMessage(): string {
    return `⛔️ <b>Kechirasiz, sizga ushbu botdan foydalanish uchun ruxsat berilmagan!</b>\n\nIltimos, administrator bilan bog'laning.`;
  }

  static askPostContent(): string {
    return (
      `📝 <b>1-Qadam: E'lon matnini yoki mediasini (rasm/video/hujjat) yuboring.</b>\n\n` +
      `<i>Eslatma: Matn bilan birga rasm yuborishingiz ham mumkin.</i>`
    );
  }

  static selectTargetsMessage(targets: TargetItem[], selectedIds: string[]): string {
    if (!targets || targets.length === 0) {
      return (
        `⚠️ <b>Hozircha birorta ham kanal yoki guruh qo'shilmagan.</b>\n\n` +
        `Avval /channels yoki /groups orqali kanal/guruh qo'shing.`
      );
    }
    return (
      `🎯 <b>2-Qadam: E'lon yuboriladigan maqsadli chatlarni tanlang:</b>\n\n` +
      `Quyidagi tugmalar orqali belgilang va yakunlanganda <b>"Davom etish ➡️"</b> tugmasini bosing:`
    );
  }

  static chooseScheduleTypeMessage(): string {
    return (
      `⏱ <b>3-Qadam: E'lonni qachon yuborishni tanlang:</b>\n\n` +
      `⚡️ <b>Darhol yuborish</b> — Tanlangan chatlarga hoziroq yuboriladi.\n` +
      `⏰ <b>Rejalashtirish (Deadline)</b> — Belgilangan sana va vaqtda avtomatik yuboriladi.`
    );
  }

  static askScheduleDateMessage(): string {
    return (
      `📅 <b>E'lon yuborilishi kerak bo'lgan sana va vaqtni kiriting:</b>\n\n` +
      `Format: <code>YYYY-MM-DD HH:mm</code>\n` +
      `Misol uchun: <code>2026-09-07 15:30</code> (O'zbekiston vaqti bilan)`
    );
  }

  static postPreviewMessage(post: {
    text?: string | null;
    mediaType?: string | null;
    scheduledAt?: Date | null;
    status: string;
    targetsCount: number;
    createdAt: Date;
  }): string {
    let dateStr = 'Darhol';
    if (post.scheduledAt) {
      dateStr = new Date(post.scheduledAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });
    }

    let statusEmoji = '🟡';
    if (post.status === 'SENT') {
      statusEmoji = '🟢';
    } else if (post.status === 'FAILED') {
      statusEmoji = '🔴';
    }

    return (
      `📋 <b>E'LON TAFSILOTLARI:</b>\n` +
      `────────────────────────\n` +
      `📊 <b>Holati:</b> ${statusEmoji} ${post.status}\n` +
      `🎯 <b>Chatlar soni:</b> ${post.targetsCount} ta\n` +
      `⏰ <b>Rejalashtirilgan:</b> ${dateStr}\n` +
      `📅 <b>Yaratilgan:</b> ${new Date(post.createdAt).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}\n` +
      `────────────────────────\n\n` +
      `<b>Matn ko'rinishi:</b>\n${post.text || '<i>(Matnsiz / faqat media)</i>'}`
    );
  }

  static channelHealthCheckSuccess(title: string, username?: string | null): string {
    const handle = username ? `@${username}` : title;
    return `✅ <b>Kanal muvaffaqiyatli qo'shildi va tasdiqlandi!</b>\n\n📌 <b>Nomi:</b> ${title}\n🔗 <b>Havola:</b> ${handle}\n🛡 <b>Bot huquqi:</b> Admin (Post joylash mumkin)`;
  }

  static channelHealthCheckFailed(title: string, error: string): string {
    return `❌ <b>Kanalni tekshirishda xatolik!</b>\n\n📌 <b>Kanal:</b> ${title}\n⚠️ <b>Sabab:</b> ${error}\n\n<i>Iltimos, botni kanalga administrator qilib qo'shganingizga va xabar yuborish huquqi borligiga ishonch hosil qiling.</i>`;
  }
}
