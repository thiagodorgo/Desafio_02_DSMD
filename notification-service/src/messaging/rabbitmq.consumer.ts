import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RabbitMQConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQConsumer.name);

  private readonly exchange = process.env.RABBITMQ_EXCHANGE || 'payments.exchange';
  private readonly rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin@rabbitmq:5672';
  private connection: amqplib.ChannelModel;
  private channel: amqplib.Channel;

  constructor(private readonly notificationsService: NotificationsService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    let retries = 5;
    while (retries > 0) {
      try {
        this.connection = await amqplib.connect(this.rabbitmqUrl);
        this.channel = await this.connection.createChannel();

        await this.channel.assertExchange(this.exchange, 'direct', { durable: true });

        await this.channel.assertQueue('notification.payment.requested', { durable: true });
        await this.channel.bindQueue(
          'notification.payment.requested',
          this.exchange,
          'payment.requested',
        );

        await this.channel.assertQueue('notification.payment.confirmed', { durable: true });
        await this.channel.bindQueue(
          'notification.payment.confirmed',
          this.exchange,
          'payment.confirmed',
        );

        this.logger.log('Aguardando eventos do RabbitMQ...');

        this.channel.consume('notification.payment.requested', (msg) => {
          if (!msg) return;
          try {
            const content = JSON.parse(msg.content.toString());
            this.notificationsService.handlePaymentRequested(content);
            this.channel.ack(msg);
          } catch (error) {
            this.logger.error(`Erro ao processar PAYMENT_REQUESTED: ${error.message}`);
            this.channel.nack(msg, false, false);
          }
        });

        this.channel.consume('notification.payment.confirmed', (msg) => {
          if (!msg) return;
          try {
            const content = JSON.parse(msg.content.toString());
            this.notificationsService.handlePaymentConfirmed(content);
            this.channel.ack(msg);
          } catch (error) {
            this.logger.error(`Erro ao processar PAYMENT_CONFIRMED: ${error.message}`);
            this.channel.nack(msg, false, false);
          }
        });

        return;
      } catch (error) {
        retries -= 1;
        this.logger.warn(`Falha ao conectar ao RabbitMQ. Tentativas restantes: ${retries}`);
        if (retries === 0) {
          throw new Error('Não foi possível conectar ao RabbitMQ após múltiplas tentativas.');
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async disconnect() {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      this.logger.warn('Erro ao encerrar conexão com RabbitMQ.');
    }
  }
}
