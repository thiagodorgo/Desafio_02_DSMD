import { Injectable, Logger } from '@nestjs/common';

export interface PaymentRequestedEvent {
  event: string;
  transactionId: string;
  userId: string;
  amount: number;
  description?: string;
  status: string;
  createdAt: string;
}

export interface PaymentConfirmedEvent {
  event: string;
  transactionId: string;
  userId: string;
  amount: number;
  description?: string;
  status: string;
  confirmedAt: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  handlePaymentRequested(event: PaymentRequestedEvent) {
    this.logger.log(
      `[NOTIFICATION] Usuário ${event.userId}: sua solicitação de pagamento da transação ${event.transactionId} foi recebida e está pendente.`,
    );
  }

  handlePaymentConfirmed(event: PaymentConfirmedEvent) {
    this.logger.log(
      `[NOTIFICATION] Usuário ${event.userId}: seu pagamento da transação ${event.transactionId} foi confirmado com sucesso.`,
    );
  }
}
