import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { PaymentsModule } from './payments/payments.module';
import { RabbitMQModule } from './messaging/rabbitmq.module';

@Module({
  imports: [DatabaseModule, RabbitMQModule, PaymentsModule],
})
export class AppModule {}
