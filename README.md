# Desafio_02_DSMD

Aplicação de microsserviços para processamento de pagamento e notificação assíncrona, desenvolvida para o desafio da disciplina **Desenvolvimento de Sistemas Distribuídos**.

O projeto simula parte da plataforma da empresa fictícia **CompreFácil**, reestruturando o fluxo de pagamentos com serviços independentes, comunicação assíncrona e banco de dados relacional.

---

## Objetivo Acadêmico

Este projeto demonstra na prática:

- Serviços independentes com responsabilidades bem definidas
- Comunicação assíncrona via mensageria (RabbitMQ / AMQP)
- Processamento de transação de pagamento com persistência
- Notificação baseada em eventos, sem acoplamento direto entre serviços

---

## Tecnologias Utilizadas

| Tecnologia     | Finalidade                            |
|----------------|---------------------------------------|
| Node.js        | Runtime JavaScript                    |
| NestJS         | Framework backend                     |
| TypeScript     | Tipagem estática                      |
| PostgreSQL      | Banco de dados relacional             |
| Prisma         | ORM para acesso ao banco              |
| RabbitMQ       | Broker de mensagens                   |
| Docker         | Containerização dos serviços          |
| Docker Compose | Orquestração local dos containers     |

---

## Arquitetura

```
Cliente (Postman / curl / Insomnia)
         |
         | REST (HTTP)
         v
  payment-service  ──── Prisma ────> PostgreSQL
         |
         | AMQP (RabbitMQ)
         v
notification-service
```

---

## Estrutura do Repositório

```
Desafio_02_DSMD/
├── payment-service/           # Microsserviço de pagamento (REST + Publisher)
│   ├── prisma/                # Schema do Prisma
│   ├── src/
│   │   ├── config/            # Configuração de variáveis de ambiente
│   │   ├── database/          # Módulo e serviço do Prisma
│   │   ├── payments/          # Controller, Service, DTOs, Entidades
│   │   └── messaging/         # Módulo e serviço RabbitMQ (publisher)
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
│
├── notification-service/      # Microsserviço de notificação (Consumer)
│   ├── src/
│   │   ├── config/            # Configuração de variáveis de ambiente
│   │   ├── notifications/     # Módulo e serviço de notificações
│   │   └── messaging/         # Módulo e consumer RabbitMQ
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
│
├── docs/
│   ├── architecture.md        # Decisões arquiteturais
│   └── flow.md                # Fluxo detalhado da aplicação
│
├── docker-compose.yml
├── README.md
└── .gitignore
```

---

## Como Executar

### Pré-requisitos

- [Docker](https://www.docker.com/) instalado
- [Docker Compose](https://docs.docker.com/compose/) instalado

### 1. Clonar o repositório

```bash
git clone https://github.com/thiagodorgo/Desafio_02_DSMD.git
cd Desafio_02_DSMD
```

### 2. Subir todos os serviços

```bash
docker compose up --build
```

> O Docker Compose irá subir: PostgreSQL, RabbitMQ, payment-service e notification-service.
> As migrations do Prisma são executadas automaticamente no startup do payment-service.

Aguarde até ver nos logs:
```
payment-service    | [PaymentService] Serviço de pagamento inicializado.
notification-service | [RabbitMQConsumer] Aguardando eventos do RabbitMQ...
```

---

## Como Testar

> No PowerShell, `curl` é um alias de `Invoke-WebRequest` e não aceita as flags `-H`/`-d` no formato do curl do Linux. Use os exemplos PowerShell abaixo.

### Criar um pagamento

**Linux/macOS (curl):**

```bash
curl -X POST http://localhost:3000/payments \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-001",
    "amount": 149.90,
    "description": "Compra no e-commerce CompreFácil"
  }'
```

**Windows PowerShell (Invoke-RestMethod):**

```powershell
$body = @{
  userId = "user-001"
  amount = 149.90
  description = "Compra no e-commerce CompreFácil"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/payments" `
  -ContentType "application/json" `
  -Body $body
```

### Listar todos os pagamentos

```bash
curl http://localhost:3000/payments
```

### Buscar pagamento por ID

```bash
curl http://localhost:3000/payments/<id>
```

### Verificar status do notification-service

```bash
curl http://localhost:3001/health
```

---

## Resultado Esperado

Ao criar um pagamento:

1. A transação é criada com status **PENDING** no PostgreSQL
2. O evento `PAYMENT_REQUESTED` é publicado no RabbitMQ
3. O `notification-service` consome o evento e exibe no console:
   ```
   [NOTIFICATION] Usuário user-001: sua solicitação de pagamento da transação <id> foi recebida e está pendente.
   ```
4. O `payment-service` continua o processamento em background, simula a confirmação e atualiza o status para **SUCCESS**
5. O evento `PAYMENT_CONFIRMED` é publicado no RabbitMQ
6. O `notification-service` consome o evento e exibe:
   ```
   [NOTIFICATION] Usuário user-001: seu pagamento da transação <id> foi confirmado com sucesso.
   ```

---

## Acesso ao RabbitMQ Management

| Campo  | Valor                     |
|--------|---------------------------|
| URL    | http://localhost:15672    |
| Usuário | admin                    |
| Senha  | admin                     |

---

## Endpoints Disponíveis

### payment-service (porta 3000)

| Método | Endpoint      | Descrição                      |
|--------|---------------|--------------------------------|
| POST   | /payments     | Criar e processar um pagamento |
| GET    | /payments     | Listar todas as transações     |
| GET    | /payments/:id | Buscar transação por ID        |

### notification-service (porta 3001)

| Método | Endpoint | Descrição                      |
|--------|----------|--------------------------------|
| GET    | /health  | Status do notification-service |

---

## Critérios de Avaliação Atendidos

| Critério                                  | Status     |
|-------------------------------------------|------------|
| Serviços independentes                    | ✅ Atendido |
| Comunicação assíncrona com mensageria     | ✅ Atendido |
| Fluxo completo de processamento de pagamento | ✅ Atendido |
| Banco de dados relacional com Prisma      | ✅ Atendido |
| Containerização com Docker Compose        | ✅ Atendido |
| Documentação e README profissional        | ✅ Atendido |

---

## Observações

- As notificações do `notification-service` são simuladas via logs (`logger.log`) para manter o escopo acadêmico do desafio.
- O endpoint `POST /payments` retorna a transação inicialmente em `PENDING`; a confirmação para `SUCCESS` ocorre de forma assíncrona em background.

Este projeto foi estruturado para entrega acadêmica e versionamento no GitHub, seguindo boas práticas de desenvolvimento com microsserviços.
