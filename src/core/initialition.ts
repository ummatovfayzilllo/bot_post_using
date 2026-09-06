import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from 'src/global/errorhandler/all-exceptions.filter';
import { AppLoggerService } from 'src/global/logger/logger.service';

export async function initializeApp(app: INestApplication): Promise<void> {
  // Global Logger
  const logger = app.get(AppLoggerService);
  app.useLogger(logger);

  // Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
}
