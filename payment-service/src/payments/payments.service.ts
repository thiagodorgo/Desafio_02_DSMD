import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RabbitMQService } from '../messaging/rabbitmq.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentStatus } from '@prisma/client';

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

    this.rabbitMQ.publishPaymentRequested({
      event: 'PAYMENT_REQUESTED',
      transactionId: transaction.id,
      userId: transaction.userId,
      amount: transaction.amount,
      description: transaction.description,
      status: transaction.status,
      createdAt: transaction.createdAt.toISOString(),
    });

    await this.simulateProcessing();

    const confirmed = await this.prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { status: PaymentStatus.SUCCESS },
    });

    this.logger.log(`Transação atualizada para SUCCESS: ${confirmed.id}`);

    this.rabbitMQ.publishPaymentConfirmed({
      event: 'PAYMENT_CONFIRMED',
      transactionId: confirmed.id,
      userId: confirmed.userId,
      amount: confirmed.amount,
      description: confirmed.description,
      status: confirmed.status,
      confirmedAt: confirmed.updatedAt.toISOString(),
    });

    return confirmed;
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

  private simulateProcessing(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
