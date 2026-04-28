import { Module } from '@nestjs/common';
import { NotificationsModule } from './notifications/notifications.module';
import { RabbitMQModule } from './messaging/rabbitmq.module';

@Module({
  imports: [RabbitMQModule, NotificationsModule],
})
export class AppModule {}
