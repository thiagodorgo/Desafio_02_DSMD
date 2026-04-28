import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import * as amqplib from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqplib.Connection;
  private channel: amqplib.Channel;

  private readonly exchange = process.env.RABBITMQ_EXCHANGE || 'payments.exchange';
  private readonly rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin@rabbitmq:5672';

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

        this.logger.log('Conexão com RabbitMQ estabelecida.');
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

  publishPaymentRequested(payload: object) {
    this.publish('payment.requested', payload);
  }

  publishPaymentConfirmed(payload: object) {
    this.publish('payment.confirmed', payload);
  }

  private publish(routingKey: string, payload: object) {
    try {
      this.channel.publish(
        this.exchange,
        routingKey,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true },
      );
      this.logger.log(`Evento publicado com routing key: ${routingKey}`);
    } catch (error) {
      this.logger.error(`Falha ao publicar evento [${routingKey}]: ${error.message}`);
    }
  }
}
