import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RabbitMQService } from '../messaging/rabbitmq.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentStatus, PaymentTransaction } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMQ: RabbitMQService,
  ) {
    this.logger.log('Serviço de pagamento inicializado.');
  }

  async create(dto: CreatePaymentDto) {
    const transaction = await this.prisma.paymentTransaction.create({
      data: {
        userId: dto.userId,
        amount: dto.amount,
        description: dto.description,
        status: PaymentStatus.PENDING,
      },
    });

    this.logger.log(`Transação criada com status PENDING: ${transaction.id}`);

    const requestedPublished = this.rabbitMQ.publishPaymentRequested({
      event: 'PAYMENT_REQUESTED',
      transactionId: transaction.id,
      userId: transaction.userId,
      amount: transaction.amount,
      description: transaction.description,
      status: transaction.status,
      createdAt: transaction.createdAt.toISOString(),
    });

    if (!requestedPublished) {
      this.logger.warn(`Falha ao publicar PAYMENT_REQUESTED para transação ${transaction.id}.`);
    }

    void this.processConfirmation(transaction).catch((error) => {
      this.logger.error(
        `Erro no processamento em background da transação ${transaction.id}: ${error.message}`,
      );
    });

    return transaction;
  }

  async findAll() {
    return this.prisma.paymentTransaction.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException(`Transação com ID ${id} não encontrada.`);
    }

    return transaction;
  }

  private async processConfirmation(transaction: PaymentTransaction) {
    await this.simulateProcessing();

    const confirmed = await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: PaymentStatus.SUCCESS },
    });

    this.logger.log(`Transação atualizada para SUCCESS: ${confirmed.id}`);

    const confirmedPublished = this.rabbitMQ.publishPaymentConfirmed({
      event: 'PAYMENT_CONFIRMED',
      transactionId: confirmed.id,
      userId: confirmed.userId,
      amount: confirmed.amount,
      description: confirmed.description,
      status: confirmed.status,
      confirmedAt: confirmed.updatedAt.toISOString(),
    });

    if (!confirmedPublished) {
      this.logger.warn(`Falha ao publicar PAYMENT_CONFIRMED para transação ${confirmed.id}.`);
    }
  }

  private simulateProcessing(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
