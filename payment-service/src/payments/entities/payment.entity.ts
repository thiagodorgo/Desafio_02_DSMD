import { PaymentStatus } from '@prisma/client';

export class PaymentEntity {
  id: string;
  userId: string;
  amount: number;
  description?: string;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}
