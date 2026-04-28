# Fluxo de Pagamento e Notificação

## Visão Geral

Este documento descreve o fluxo completo desde a solicitação de pagamento até as notificações ao usuário.

---

## Passo a Passo

### 1. Cliente envia `POST /payments`

O cliente (Postman, curl, frontend) realiza uma requisição HTTP para o `payment-service`:

```
POST http://localhost:3000/payments
Content-Type: application/json

{
  "userId": "user-001",
  "amount": 149.90,
  "description": "Compra no e-commerce CompreFácil"
}
```

O payload é validado pelo DTO antes de prosseguir.

---

### 2. payment-service grava transação com status PENDING

O serviço cria um registro no PostgreSQL via Prisma:

```
PaymentTransaction {
  id: "uuid-gerado",
  userId: "user-001",
  amount: 149.90,
  description: "Compra no e-commerce CompreFácil",
  status: PENDING,
  createdAt: "2024-...",
  updatedAt: "2024-..."
}
```

---

### 3. payment-service publica PAYMENT_REQUESTED

Após persistir a transação, o serviço publica no RabbitMQ:

- **Exchange**: `payments.exchange`
- **Routing key**: `payment.requested`
- **Fila**: `notification.payment.requested`

Payload do evento:

```json
{
  "event": "PAYMENT_REQUESTED",
  "transactionId": "uuid-gerado",
  "userId": "user-001",
  "amount": 149.90,
  "description": "Compra no e-commerce CompreFácil",
  "status": "PENDING",
  "createdAt": "2024-..."
}
```

---

### 4. notification-service consome PAYMENT_REQUESTED

O consumer do `notification-service` recebe a mensagem e exibe no console:

```
[NOTIFICATION] Usuário user-001: sua solicitação de pagamento da transação uuid-gerado foi recebida e está pendente.
```

---

### 5. payment-service simula a confirmação do pagamento

Após publicar o evento inicial, o `payment-service` executa a lógica de confirmação (simulada com um delay controlado).

---

### 6. payment-service atualiza a transação para SUCCESS

O registro no PostgreSQL é atualizado via Prisma:

```
PaymentTransaction {
  ...
  status: SUCCESS,
  updatedAt: "2024-... (novo timestamp)"
}
```

---

### 7. payment-service publica PAYMENT_CONFIRMED

O serviço publica um segundo evento no RabbitMQ:

- **Exchange**: `payments.exchange`
- **Routing key**: `payment.confirmed`
- **Fila**: `notification.payment.confirmed`

Payload do evento:

```json
{
  "event": "PAYMENT_CONFIRMED",
  "transactionId": "uuid-gerado",
  "userId": "user-001",
  "amount": 149.90,
  "description": "Compra no e-commerce CompreFácil",
  "status": "SUCCESS",
  "confirmedAt": "2024-..."
}
```

---

### 8. notification-service consome PAYMENT_CONFIRMED

O consumer processa a segunda mensagem e exibe:

```
[NOTIFICATION] Usuário user-001: seu pagamento da transação uuid-gerado foi confirmado com sucesso.
```

---

## Diagrama de Sequência

```
Cliente           payment-service         PostgreSQL        RabbitMQ       notification-service
   |                    |                      |                |                    |
   |-- POST /payments -->|                      |                |                    |
   |                    |-- INSERT (PENDING) -->|                |                    |
   |                    |<-- transação criada --|                |                    |
   |                    |-- publish PAYMENT_REQUESTED ---------->|                    |
   |                    |                      |                |-- PAYMENT_REQUESTED->|
   |                    |                      |                |                    |-- log console
   |                    |-- confirmação (simul) |                |                    |
   |                    |-- UPDATE (SUCCESS) -->|                |                    |
   |                    |<-- transação atualizada               |                    |
   |                    |-- publish PAYMENT_CONFIRMED ---------->|                    |
   |                    |                      |                |-- PAYMENT_CONFIRMED->|
   |                    |                      |                |                    |-- log console
   |<-- 200 response ---|                      |                |                    |
```
