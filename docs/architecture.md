# Arquitetura do Sistema

## Por que dois serviços?

A separação entre `payment-service` e `notification-service` reflete um princípio fundamental de microsserviços: cada serviço possui uma única responsabilidade bem definida.

- **payment-service**: responsável por receber solicitações de pagamento, persistir transações no banco de dados e publicar eventos de domínio.
- **notification-service**: responsável por reagir a eventos de pagamento e simular o envio de notificações ao usuário.

Essa separação garante que uma falha ou atualização em um serviço não impacte diretamente o outro. O `notification-service` pode ser reiniciado, escalado ou substituído sem que o fluxo de pagamento seja interrompido.

## Por que RabbitMQ?

RabbitMQ foi escolhido como broker de mensagens porque:

- Implementa o protocolo **AMQP** (Advanced Message Queuing Protocol), amplamente adotado em arquiteturas distribuídas.
- Oferece filas duráveis e garantias de entrega de mensagens.
- Possui um painel de gerenciamento visual para monitoramento em tempo real.
- É leve, estável e adequado para ambientes Docker.

A configuração utiliza uma **exchange do tipo direct** chamada `payments.exchange`, com routing keys específicas para cada tipo de evento.

## Como a comunicação assíncrona melhora a independência

Com comunicação assíncrona:

1. O `payment-service` publica um evento e **continua sua execução imediatamente**, sem aguardar resposta do consumidor.
2. O `notification-service` processa a mensagem no seu próprio ritmo, sem acoplamento temporal com o publicador.
3. Se o `notification-service` estiver temporariamente indisponível, as mensagens ficam **enfileiradas** no RabbitMQ e são consumidas quando o serviço se recuperar.

Isso garante **resiliência** e **desacoplamento** entre os serviços.

## Como o PostgreSQL é usado pelo payment-service

O `payment-service` é o único serviço com acesso ao banco de dados. Ele utiliza o **Prisma ORM** para:

- Criar registros de transação com status inicial `PENDING`
- Atualizar o status para `SUCCESS` após confirmação
- Consultar transações por ID ou listar todas

O esquema do banco é gerenciado pelo Prisma com migrations automáticas no startup do container.

## Como o notification-service consome eventos sem acoplamento direto

O `notification-service` não conhece o `payment-service`. Ele:

1. Conecta-se ao RabbitMQ no endereço configurado via variável de ambiente
2. Declara a mesma exchange (`payments.exchange`) e faz o bind das filas de interesse
3. Consome mensagens das filas `notification.payment.requested` e `notification.payment.confirmed`
4. Processa cada evento de forma independente, baseando-se apenas no conteúdo da mensagem recebida

Não há chamadas HTTP entre os serviços. O único ponto de integração é o broker de mensagens.
