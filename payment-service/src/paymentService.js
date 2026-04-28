const {
  createPendingTransaction,
  updateTransactionStatus,
} = require('./db');
const { publishEvent } = require('./rabbitmq');

const routingKey = process.env.NOTIFICATION_ROUTING_KEY || 'notification.transaction';

async function processPaymentRequest({ amount, customerEmail }) {
  const transaction = await createPendingTransaction({ amount, customerEmail });

  await publishEvent(routingKey, {
    eventType: 'TRANSACTION_REQUEST_RECEIVED',
    transactionId: transaction.id,
    amount: Number(transaction.amount),
    customerEmail: transaction.customer_email,
    status: transaction.status,
    message: 'Solicitação de transação recebida.',
    emittedAt: new Date().toISOString(),
  });

  setTimeout(async () => {
    try {
      const confirmed = await updateTransactionStatus({
        transactionId: transaction.id,
        status: 'SUCCESS',
      });

      await publishEvent(routingKey, {
        eventType: 'TRANSACTION_CONFIRMED',
        transactionId: confirmed.id,
        amount: Number(confirmed.amount),
        customerEmail: confirmed.customer_email,
        status: confirmed.status,
        message: 'Transação confirmada com sucesso.',
        emittedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[payment-service] Falha ao confirmar transação:', error.message);
    }
  }, 2000);

  return transaction;
}

module.exports = {
  processPaymentRequest,
};
