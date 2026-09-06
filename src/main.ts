import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { initializeApp } from './core/initialition';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  await initializeApp(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Ilova muvaffaqiyatli ishga tushdi: http://localhost:${port}`);
}

bootstrap();
