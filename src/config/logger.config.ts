import { WinstonModule } from 'nest-winston';
import { format, transports } from 'winston';

const { combine, timestamp, colorize, printf, json } = format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(
    ({ level, message, timestamp, context }) =>
      `${timestamp} [${context ?? 'App'}] ${level}: ${message}`,
  ),
);

const prodFormat = combine(timestamp(), json());

export const winstonConfig = WinstonModule.forRoot({
  transports: [
    new transports.Console({
      format: process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
    }),
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(timestamp(), json()),
    }),
    new transports.File({
      filename: 'logs/combined.log',
      format: combine(timestamp(), json()),
    }),
  ],
});
