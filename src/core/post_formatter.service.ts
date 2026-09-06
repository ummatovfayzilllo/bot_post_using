import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';

export interface AiAnalysisResult {
  type: 'POST' | 'CHAT';
  content: string;
}

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
        execFile('agy', ['-p', prompt], { timeout: 30000 }, (error, stdout) => {
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

  async analyzeAndProcess(rawText: string): Promise<AiAnalysisResult> {
    if (!rawText || !rawText.trim()) {
      return { type: 'CHAT', content: 'Xabar matni bo\'sh.' };
    }

    const prompt = (
      `Sen professional Telegram AI Assistanti va SMM mutaxassisisan.\n` +
      `Quyidagi foydalanuvchi xabarini tahlil qil va mos ravishda ishlov ber:\n\n` +
      `1. Agar xabar kanal/guruhga e'lon qilish uchun mo'ljallangan E'LON yoki POST (oldi-sotdi, mashina, uy, xizmat, yangilik) bo'lsa:\n` +
      `- Uni Telegram uchun mos, chiroyli emojilar va to'g'ri yopilgan HTML (<b>, <i>, <code>) bilan professional formatga keltir.\n` +
      `- JSON shaklida qaytar: {"type": "POST", "content": "<formatlangan_post_matni>"}\n\n` +
      `2. Agar xabar SAVOL, YORDAM SO'RASH, bot qanday ishlashi haqida yoki ERKIN SUHBAT bo'lsa:\n` +
      `- Foydalanuvchiga o'zbek tilida muloyim, aniq va tushunarli yordam beruvchi javob yoz.\n` +
      `- JSON shaklida qaytar: {"type": "CHAT", "content": "<foydalanuvchiga_javob_matni>"}\n\n` +
      `QAT'IY QOIDA: Faqat toza JSON formatida javob qaytar! Hech qanday markdown \`\`\`json blokisiz, toza JSON matnini ber.\n\n` +
      `Foydalanuvchi xabari:\n"""\n${rawText.trim()}\n"""`
    );

    return new Promise((resolve) => {
      try {
        execFile('agy', ['-p', prompt], { timeout: 35000 }, (error, stdout) => {
          if (error) {
            this.logger.warn(`analyzeAndProcess agy xatoligi: ${error.message}`);
            resolve({ type: 'CHAT', content: rawText });
            return;
          }

          let output = stdout.trim();
          // Tozalash agar ```json bilan o'ralgan bo'lsa
          if (output.startsWith('```json')) {
            output = output.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (output.startsWith('```')) {
            output = output.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }

          try {
            const parsed = JSON.parse(output) as AiAnalysisResult;
            if (parsed && (parsed.type === 'POST' || parsed.type === 'CHAT') && parsed.content) {
              resolve(parsed);
              return;
            }
          } catch (jsonErr) {
            this.logger.warn(`JSON parse xatosi: ${jsonErr.message}, output: ${output}`);
          }

          // Fallback
          resolve({ type: 'CHAT', content: output || rawText });
        });
      } catch (err) {
        this.logger.error('analyzeAndProcess da xatolik:', err);
        resolve({ type: 'CHAT', content: rawText });
      }
    });
  }
}
