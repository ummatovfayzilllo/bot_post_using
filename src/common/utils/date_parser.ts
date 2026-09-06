export class SmartDateParser {
  /**
   * Foydalanuvchi kiritgan vaqt matnini tahlil qiladi (Tashkent UTC+5).
   * Qo'llab-quvvatlanadigan formatlar:
   * - +5m, 10m, 30m (daqiqa qo'shish)
   * - +1h, 2h (soat qo'shish)
   * - 14:30, 09:15 (faqat soat/daqiqa, bugungi kun uchun)
   * - 2026-09-06 14:30 (to'liq sana va vaqt)
   */
  static parseDate(input: string): Date | null {
    if (!input || !input.trim()) {
      return null;
    }

    const raw = input.trim().toLowerCase();
    const now = new Date();

    // 1. Nisbiy daqiqalar (+5m, 10m, 15m)
    const minuteMatch = raw.match(/^\+?(\d+)\s*m(?:in)?$/);
    if (minuteMatch) {
      const mins = parseInt(minuteMatch[1], 10);
      if (mins > 0 && mins <= 43200) { // max 30 kun
        return new Date(now.getTime() + mins * 60 * 1000);
      }
    }

    // 2. Nisbiy soatlar (+1h, 2h, 5h)
    const hourMatch = raw.match(/^\+?(\d+)\s*h(?:our)?$/);
    if (hourMatch) {
      const hours = parseInt(hourMatch[1], 10);
      if (hours > 0 && hours <= 720) { // max 30 kun
        return new Date(now.getTime() + hours * 60 * 60 * 1000);
      }
    }

    // 3. Faqat soat va daqiqa (14:30 yoki 09:15)
    const timeOnlyMatch = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (timeOnlyMatch) {
      const hours = parseInt(timeOnlyMatch[1], 10);
      const minutes = parseInt(timeOnlyMatch[2], 10);

      if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        // Tashkent vaqti bo'yicha bugungi kun
        const tashkentTimeStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' }); // YYYY-MM-DD
        const paddedHours = hours.toString().padStart(2, '0');
        const paddedMinutes = minutes.toString().padStart(2, '0');

        const targetDate = new Date(`${tashkentTimeStr}T${paddedHours}:${paddedMinutes}:00+05:00`);

        // Agar kiritilgan vaqt bugungi kunda o'tib ketgan bo'lsa, ertangi kunga o'tkazamiz
        if (targetDate.getTime() <= now.getTime()) {
          targetDate.setDate(targetDate.getDate() + 1);
        }

        return targetDate;
      }
    }

    // 4. To'liq sana va vaqt (YYYY-MM-DD HH:mm)
    const fullDateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})$/);
    if (fullDateMatch) {
      const datePart = fullDateMatch[1];
      const hours = parseInt(fullDateMatch[2], 10).toString().padStart(2, '0');
      const minutes = parseInt(fullDateMatch[3], 10).toString().padStart(2, '0');

      const targetDate = new Date(`${datePart}T${hours}:${minutes}:00+05:00`);
      if (!isNaN(targetDate.getTime()) && targetDate.getTime() > now.getTime()) {
        return targetDate;
      }
    }

    return null;
  }

  static getTashkentNowFormatted(): string {
    return new Date().toLocaleTimeString('uz-UZ', {
      timeZone: 'Asia/Tashkent',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
