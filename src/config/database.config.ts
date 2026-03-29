import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const typeOrmConfig = (config: ConfigService): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: config.get('DB_HOST'),
  port: Number(config.get('DB_PORT')),
  username: config.get('DB_USERNAME'),
  password: config.get('DB_PASSWORD'),
  database: config.get('DB_NAME'),
  autoLoadEntities: true,
  synchronize: config.get('NODE_ENV') !== 'production',
  ssl: { rejectUnauthorized: false },
  logging: config.get('NODE_ENV') === 'development',
});
