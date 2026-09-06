import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';

@Injectable()
export class PostFormatterService {
  private readonly logger = new Logger(PostFormatterService.name);
  private readonly scriptPath = path.resolve(process.cwd(), 'scripts', 'beautify_post.py');

  async beautifyPost(rawText: string): Promise<string> {
    if (!rawText || !rawText.trim()) {
      return rawText;
    }

    return new Promise((resolve) => {
      try {
        const process = spawn('python3', [this.scriptPath], {
          timeout: 25000,
        });

        let output = '';
        let errorOutput = '';

        process.stdout.on('data', (data) => {
          output += data.toString();
        });

        process.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0 && output.trim()) {
            resolve(output.trim());
          } else {
            this.logger.warn(`Post formatlashda ogohlantirish (code: ${code}): ${errorOutput}`);
            resolve(rawText); // Xatolik bo'lsa asl matnni qaytaramiz
          }
        });

        process.on('error', (err) => {
          this.logger.error('PostFormatter jarayonida xatolik:', err);
          resolve(rawText);
        });

        // Stdin orqali matnni uzatamiz
        process.stdin.write(rawText);
        process.stdin.end();
      } catch (error) {
        this.logger.error('beautifyPost da kutilmagan xatolik:', error);
        resolve(rawText);
      }
    });
  }
}
