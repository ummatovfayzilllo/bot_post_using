import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { BotConnectorService } from './bot_connector.service';
import { execFile } from 'child_process';

export interface AiAnalysisResult {
  type: 'POST' | 'CHAT';
  content: string;
}

@Injectable()
export class PostFormatterService {
  private readonly logger = new Logger(PostFormatterService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getSystemContext(): Promise<string> {
    try {
      const channels = await this.prisma.channel.findMany({ select: { title: true, username: true } });
      const groups = await this.prisma.group.findMany({ select: { title: true, username: true } });
      const scheduledCount = await this.prisma.post.count({ where: { status: 'SCHEDULED' } });
      const sentCount = await this.prisma.post.count({ where: { status: 'SENT' } });

      const channelList = channels.map((c) => `${c.title}${c.username ? ` (@${c.username})` : ''}`).join(', ') || 'Hozircha yo\'q';
      const groupList = groups.map((g) => `${g.title}${g.username ? ` (@${g.username})` : ''}`).join(', ') || 'Hozircha yo\'q';

      const botName = BotConnectorService.getBotName() || 'Post Bot';
      return (
        `Sen "${botName}" Telegram botining rasmiy aqlli AI assistenti va SMM mutaxassisisan.\n\n` +
        `BOTNING ASOSIY VAZIFASI VA BUYRUQLARI:\n` +
        `- /new_post — Kanallar va guruhlarga yangi e'lon yaratish (matn, rasm, video yoki ovozli xabar orqali).\n` +
        `- /channels va /groups — Kanal va guruhlarni qo'shish hamda botning admin huquqini tekshirish (Health Check).\n` +
        `- /posts — Kutilayotgan (rejalashtirilgan) va arxivdagi e'lonlarni ko'rish, darhol yuborish yoki o'chirish.\n` +
        `- /cancel — Har qanday jarayonni bekor qilish.\n\n` +
        `[LOYIHANGING REAL-TIME HOLATI]:\n` +
        `- Ulangan kanallar (${channels.length} ta): ${channelList}\n` +
        `- Ulangan guruhlar (${groups.length} ta): ${groupList}\n` +
        `- Kutilayotgan (rejalashtirilgan) postlar soni: ${scheduledCount} ta\n` +
        `- Yuborilgan (arxiv) postlar soni: ${sentCount} ta\n`
      );
    } catch (e) {
      const botName = BotConnectorService.getBotName() || 'Post Bot';
      return `Sen "${botName}" Telegram botining rasmiy AI assistentisan.\n`;
    }
  }

  async beautifyPost(rawText: string): Promise<string> {
    if (!rawText || !rawText.trim()) {
      return rawText;
    }

    const systemContext = await this.getSystemContext();

    const prompt = (
      `${systemContext}\n` +
      `Quyidagi xom e'lon matnini Telegram kanallari uchun juda chiroyli, o'qishli, strukturali va diqqatni tortuvchi formatga keltirib ber.\n\n` +
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

    const systemContext = await this.getSystemContext();

    const prompt = (
      `${systemContext}\n` +
      `Quyidagi foydalanuvchi xabarini tahlil qil va mos ravishda ishlov ber:\n\n` +
      `1. Agar xabar kanal/guruhga e'lon qilish uchun mo'ljallangan E'LON yoki POST (oldi-sotdi, mashina, uy, xizmat, yangilik) bo'lsa:\n` +
      `- Uni Telegram uchun mos, chiroyli emojilar va to'g'ri yopilgan HTML (<b>, <i>, <code>) bilan professional formatga keltir.\n` +
      `- JSON shaklida qaytar: {"type": "POST", "content": "<formatlangan_post_matni>"}\n\n` +
      `2. Agar xabar SAVOL, YORDAM SO'RASH, bot qanday ishlashi haqida, kanallar holati yoki ERKIN SUHBAT bo'lsa:\n` +
      `- Yuqoridagi [LOYIHANGING REAL-TIME HOLATI] va bot imkoniyatlaridan kelib chiqib, foydalanuvchiga o'zbek tilida muloyim, aniq va tushunarli javob yoz.\n` +
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

          resolve({ type: 'CHAT', content: output || rawText });
        });
      } catch (err) {
        this.logger.error('analyzeAndProcess da xatolik:', err);
        resolve({ type: 'CHAT', content: rawText });
      }
    });
  }
}
