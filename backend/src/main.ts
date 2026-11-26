import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      // Allow any localhost port — Vite picks the next free port
      if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) cb(null, true);
      else cb(new Error('Not allowed by CORS'));
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
