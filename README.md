# Desafio 02 — Aplicação de Pagamento (Microsserviços)

## Objetivo desta entrega
Esta entrega implementa o cenário pedido no desafio acadêmico:
- serviço de pagamento independente;
- serviço de notificação independente;
- comunicação assíncrona via RabbitMQ;
- persistência de transação no Postgres;
- fluxo assíncrono de transação (pendente -> notificação -> sucesso -> notificação).

## Escopo (acadêmico, não produção)
- Implementação mínima funcional para atender os requisitos do enunciado.
- Não inclui hardening de segurança, observabilidade avançada, autenticação/autorização e estratégias avançadas de resiliência.

## Estrutura

```text
.
├── docker-compose.yml
├── payment-service
│   ├── Dockerfile
│   ├── package.json
│   └── src
│       ├── db.js
│       ├── index.js
│       ├── paymentService.js
│       └── rabbitmq.js
└── notification-service
    ├── Dockerfile
    ├── package.json
    └── src
        └── index.js
```

## Execução

### 1) Subir stack
```bash
docker compose up --build
```

### 2) Healthchecks
```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
```

### 3) Criar transação (fluxo assíncrono)
```bash
curl -X POST http://localhost:3000/payments \
  -H "Content-Type: application/json" \
  -d '{"amount": 149.90, "customerEmail": "cliente@exemplo.com"}'
```

### 4) Consultar status da transação
```bash
curl http://localhost:3000/payments/1
```

### 5) Ver notificações recebidas
```bash
curl http://localhost:3001/notifications
```

## Fluxo implementado (mapeado ao enunciado)
1. `payment-service` recebe `POST /payments`.
2. Persiste transação com status `PENDING` no Postgres.
3. Publica evento AMQP `TRANSACTION_REQUEST_RECEIVED`.
4. `notification-service` consome e registra notificação de recebimento.
5. `payment-service` confirma transação e atualiza para `SUCCESS`.
6. `payment-service` publica evento `TRANSACTION_CONFIRMED`.
7. `notification-service` consome e registra notificação de confirmação.

## Endpoints

### payment-service (porta 3000)
- `GET /health`
- `POST /payments`
- `GET /payments/:id`

### notification-service (porta 3001)
- `GET /health`
- `GET /notifications`
- `POST /notifications/test` (interface REST adicional para demonstração)

## Filas / Exchange
- Exchange: `ecommerce.events` (topic)
- Routing key: `notification.transaction`
- Queue: `notifications.queue`

## Limitações conhecidas
- Sem autenticação/autorização.
- Sem testes automatizados na versão inicial.
- Notificação simulada por log e armazenamento em memória (não envia e-mail real).

## Próximos passos sugeridos (faculdade)
1. Adicionar testes de integração do fluxo assíncrono.
2. Adicionar scripts `npm run test` em ambos serviços.
3. Adicionar pequeno diagrama de arquitetura no relatório da disciplina.
