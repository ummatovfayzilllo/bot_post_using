import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';

@Injectable()
export class PostFormatterService {
  private readonly logger = new Logger(PostFormatterService.name);

  async beautifyPost(rawText: string): Promise<string> {
    if (!rawText || !rawText.trim()) {
      return rawText;
    }

    const prompt = (
      `Sen professional Telegram SMM mutaxassisissan. Quyidagi xom matnni Telegram post uchun juda chiroyli, o'qishli, strukturali va diqqatni tortuvchi formatga keltirib ber.\n\n` +
      `QAT'IY QOIDALAR:\n` +
      `1. XAVFSIZ HTML FORMAT: Faqat Telegram qo'llab-quvvatlaydigan to'g'ri yopilgan HTML teglaridan foydalan (<b>, </b>, <i>, </i>, <code>, </code>). Hech qachon noto'g'ri yopilmagan yoki <, > belgilarini o'z holicha qoldirma!\n` +
      `2. ASOSIY MA'LUMOTLARNI SAQLASH: Barcha telefon raqamlar, narxlar, ismlar, @username va havolalar 100% o'zgarmasdan saqlanishi shart.\n` +
      `3. EMOJILAR VA STRUKTURA: Sarlavha, muhim parametrlar va kontaktlar uchun mos, chiroyli emojilar qo'y.\n` +
      `4. FAQAT NATIJA: Faqat tayyor formatlangan post matnini qaytar! Hech qanday salomlashish, kirish so'zlari yoki ortiqcha tushuntirish yozma.\n\n` +
      `Asl matn:\n"""\n${rawText.trim()}\n"""`
    );

    return new Promise((resolve) => {
      try {
        execFile('agy', ['-p', prompt], { timeout: 30000 }, (error, stdout, stderr) => {
          if (error) {
            this.logger.warn(`PostFormatter agy CLI xatoligi: ${error.message}`);
            resolve(rawText);
            return;
          }

          const result = stdout.trim();
          if (result) {
            resolve(result);
          } else {
            resolve(rawText);
          }
        });
      } catch (err) {
        this.logger.error('beautifyPost da kutilmagan xatolik:', err);
        resolve(rawText);
      }
    });
  }
}
