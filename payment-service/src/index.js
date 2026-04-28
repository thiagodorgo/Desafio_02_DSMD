const express = require('express');
const { ensureSchema, getTransactionById } = require('./db');
const { connectWithRetry, close } = require('./rabbitmq');
const { processPaymentRequest } = require('./paymentService');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ service: 'payment-service', status: 'ok' });
});

app.post('/payments', async (req, res) => {
  try {
    const { amount, customerEmail } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount deve ser número maior que zero.' });
    }

    if (typeof customerEmail !== 'string' || customerEmail.length < 5) {
      return res.status(400).json({ error: 'customerEmail inválido.' });
    }

    const transaction = await processPaymentRequest({ amount, customerEmail });

    return res.status(202).json({
      message: 'Transação recebida para processamento assíncrono.',
      transaction,
    });
  } catch (error) {
    console.error('[payment-service] Erro em /payments:', error.message);
    return res.status(500).json({ error: 'Erro interno no serviço de pagamento.' });
  }
});

app.get('/payments/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id inválido.' });
    }

    const transaction = await getTransactionById(id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }

    return res.status(200).json(transaction);
  } catch (error) {
    console.error('[payment-service] Erro em GET /payments/:id:', error.message);
    return res.status(500).json({ error: 'Erro interno no serviço de pagamento.' });
  }
});

async function bootstrap() {
  const port = Number(process.env.PORT || 3000);
  await ensureSchema();
  await connectWithRetry();

  app.listen(port, () => {
    console.log(`[payment-service] escutando na porta ${port}`);
  });
}

process.on('SIGTERM', async () => {
  await close();
  process.exit(0);
});

bootstrap().catch((error) => {
  console.error('[payment-service] falha ao iniciar:', error.message);
  process.exit(1);
});
