import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RabbitMQConsumer implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQConsumer.name);

  private readonly exchange = process.env.RABBITMQ_EXCHANGE || 'payments.exchange';
  private readonly rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin@rabbitmq:5672';

  constructor(private readonly notificationsService: NotificationsService) {}

  async onModuleInit() {
    await this.connect();
  }

  private async connect() {
    let retries = 5;
    while (retries > 0) {
      try {
        const connection = await amqplib.connect(this.rabbitmqUrl);
        const channel = await connection.createChannel();

        await channel.assertExchange(this.exchange, 'direct', { durable: true });

        await channel.assertQueue('notification.payment.requested', { durable: true });
        await channel.bindQueue(
          'notification.payment.requested',
          this.exchange,
          'payment.requested',
        );

        await channel.assertQueue('notification.payment.confirmed', { durable: true });
        await channel.bindQueue(
          'notification.payment.confirmed',
          this.exchange,
          'payment.confirmed',
        );

        this.logger.log('Aguardando eventos do RabbitMQ...');

        channel.consume('notification.payment.requested', (msg) => {
          if (!msg) return;
          try {
            const content = JSON.parse(msg.content.toString());
            this.notificationsService.handlePaymentRequested(content);
            channel.ack(msg);
          } catch (error) {
            this.logger.error(`Erro ao processar PAYMENT_REQUESTED: ${error.message}`);
            channel.nack(msg, false, false);
          }
        });

        channel.consume('notification.payment.confirmed', (msg) => {
          if (!msg) return;
          try {
            const content = JSON.parse(msg.content.toString());
            this.notificationsService.handlePaymentConfirmed(content);
            channel.ack(msg);
          } catch (error) {
            this.logger.error(`Erro ao processar PAYMENT_CONFIRMED: ${error.message}`);
            channel.nack(msg, false, false);
          }
        });

        return;
      } catch (error) {
        retries -= 1;
        this.logger.warn(`Falha ao conectar ao RabbitMQ. Tentativas restantes: ${retries}`);
        if (retries === 0) {
          this.logger.error('Não foi possível conectar ao RabbitMQ após múltiplas tentativas.');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }
}
