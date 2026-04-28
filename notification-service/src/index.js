const express = require('express');
const amqp = require('amqplib');

const app = express();
app.use(express.json());

const port = Number(process.env.PORT || 3001);
const rabbitmqUrl = process.env.RABBITMQ_URL;
const exchangeName = process.env.EXCHANGE_NAME || 'ecommerce.events';
const queueName = process.env.QUEUE_NAME || 'notifications.queue';
const routingKey = process.env.ROUTING_KEY || 'notification.transaction';

if (!rabbitmqUrl) {
  throw new Error('RABBITMQ_URL não definida.');
}

const receivedNotifications = [];
let connection;
let channel;

app.get('/health', (_req, res) => {
  res.status(200).json({ service: 'notification-service', status: 'ok' });
});

app.get('/notifications', (_req, res) => {
  res.status(200).json(receivedNotifications);
});

app.post('/notifications/test', (req, res) => {
  const { customerEmail, message } = req.body;
  if (!customerEmail || !message) {
    return res.status(400).json({ error: 'customerEmail e message são obrigatórios.' });
  }

  const logItem = {
    source: 'REST_TEST',
    customerEmail,
    message,
    receivedAt: new Date().toISOString(),
  };
  receivedNotifications.push(logItem);
  console.log('[notification-service] notificação REST:', logItem);

  return res.status(201).json(logItem);
});

async function connectWithRetry(maxRetries = 20, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      connection = await amqp.connect(rabbitmqUrl);
      channel = await connection.createChannel();
      await channel.assertExchange(exchangeName, 'topic', { durable: true });
      await channel.assertQueue(queueName, { durable: true });
      await channel.bindQueue(queueName, exchangeName, routingKey);

      await channel.consume(queueName, (msg) => {
        if (!msg) return;

        try {
          const payload = JSON.parse(msg.content.toString());
          const logItem = {
            source: 'AMQP',
            eventType: payload.eventType,
            transactionId: payload.transactionId,
            customerEmail: payload.customerEmail,
            message: payload.message,
            status: payload.status,
            receivedAt: new Date().toISOString(),
          };
          receivedNotifications.push(logItem);
          console.log('[notification-service] notificação AMQP:', logItem);
          channel.ack(msg);
        } catch (error) {
          console.error('[notification-service] erro ao processar mensagem:', error.message);
          channel.nack(msg, false, false);
        }
      });

      return;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function close() {
  await channel?.close();
  await connection?.close();
}

process.on('SIGTERM', async () => {
  await close();
  process.exit(0);
});

async function bootstrap() {
  await connectWithRetry();
  app.listen(port, () => {
    console.log(`[notification-service] escutando na porta ${port}`);
  });
}

bootstrap().catch((error) => {
  console.error('[notification-service] falha ao iniciar:', error.message);
  process.exit(1);
});
