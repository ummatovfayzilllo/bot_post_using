import { Injectable, Logger } from '@nestjs/common';
import { BotConnectorService } from './bot_connector.service';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class VoiceTranscriberService {
  private readonly logger = new Logger(VoiceTranscriberService.name);
  private readonly scriptPath = path.resolve(process.cwd(), 'scripts', 'transcribe_audio.py');

  constructor(private readonly botConnector: BotConnectorService) {}

  async transcribeVoice(fileId: string): Promise<string> {
    const tempFilePath = path.join(os.tmpdir(), `tg_voice_${Date.now()}_${fileId.slice(-8)}.ogg`);

    try {
      // 1. Telegram dan fayl linkini olish
      const telegram = this.botConnector.getTelegram();
      const fileLink = await telegram.getFileLink(fileId);

      // 2. Audio faylni yuklab olish
      const response = await fetch(fileLink.href);
      if (!response.ok) {
        throw new Error(`Ovozli faylni yuklab bo'lmadi: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.promises.writeFile(tempFilePath, buffer);

      // 3. Python orqali transkripsiya qilish
      const recognizedText = await new Promise<string>((resolve) => {
        execFile('python3', [this.scriptPath, tempFilePath], { timeout: 35000 }, (error, stdout, stderr) => {
          if (error) {
            this.logger.error(`Transkripsiyada xatolik: ${error.message}`);
            resolve('');
            return;
          }
          if (stderr && stderr.trim()) {
            this.logger.warn(`Transkripsiya ogohlantirishi: ${stderr}`);
          }
          resolve(stdout.trim());
        });
      });

      return recognizedText;
    } catch (error) {
      this.logger.error('transcribeVoice da xatolik:', error);
      return '';
    } finally {
      // Vaqtinchalik faylni o'chirish
      if (fs.existsSync(tempFilePath)) {
        try {
          await fs.promises.unlink(tempFilePath);
        } catch (e) {}
      }
    }
  }
}
