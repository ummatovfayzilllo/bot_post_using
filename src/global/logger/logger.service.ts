import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

@Injectable()
export class AppLoggerService implements NestLoggerService {
  log(message: any, ...optionalParams: any[]) {
    console.log(`[INFO] [${new Date().toISOString()}]`, message, ...optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    console.error(`[ERROR] [${new Date().toISOString()}]`, message, ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    console.warn(`[WARN] [${new Date().toISOString()}]`, message, ...optionalParams);
  }

  debug?(message: any, ...optionalParams: any[]) {
    console.debug(`[DEBUG] [${new Date().toISOString()}]`, message, ...optionalParams);
  }

  verbose?(message: any, ...optionalParams: any[]) {
    console.info(`[VERBOSE] [${new Date().toISOString()}]`, message, ...optionalParams);
  }
}
