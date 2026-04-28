const amqp = require('amqplib');

const rabbitmqUrl = process.env.RABBITMQ_URL;
const exchangeName = process.env.EXCHANGE_NAME || 'ecommerce.events';

if (!rabbitmqUrl) {
  throw new Error('RABBITMQ_URL não definida.');
}

let connection;
let channel;

async function connectWithRetry(maxRetries = 20, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      connection = await amqp.connect(rabbitmqUrl);
      channel = await connection.createChannel();
      await channel.assertExchange(exchangeName, 'topic', { durable: true });
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function publishEvent(routingKey, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  channel.publish(exchangeName, routingKey, body, { persistent: true });
}

async function close() {
  await channel?.close();
  await connection?.close();
}

module.exports = {
  connectWithRetry,
  publishEvent,
  close,
};
