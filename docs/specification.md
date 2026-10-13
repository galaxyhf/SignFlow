# PROMPT — DESENVOLVIMENTO COMPLETO DO SIGNFLOW

Você é um engenheiro de software sênior especializado em aplicações SaaS, Next.js, NestJS, TypeScript, PostgreSQL, segurança de aplicações e manipulação de documentos PDF.

Sua tarefa é **desenvolver integralmente uma aplicação web chamada SignFlow**, um sistema interno de gerenciamento de documentos e coleta de assinaturas eletrônicas.

O projeto deve ser funcional, bem estruturado, seguro, responsivo e preparado para utilização real.

**IMPORTANTE: Não quero apenas um protótipo, demonstração ou estrutura inicial. Quero a implementação completa de todas as funcionalidades descritas neste documento.**

Não utilize dados fictícios permanentes, botões sem funcionalidade, endpoints simulados ou páginas que apenas exibam conteúdo estático.

## 1. Objetivo do projeto

O SignFlow será utilizado internamente por funcionários de uma empresa para enviar documentos PDF a clientes, permitindo que eles preencham informações e assinem eletronicamente pelo navegador.

O principal canal de compartilhamento será o WhatsApp.

O sistema deverá permitir:

- Cadastrar e gerenciar clientes.
- Enviar documentos PDF.
- Criar modelos reutilizáveis.
- Adicionar campos editáveis visualmente aos PDFs.
- Gerar solicitações de assinatura.
- Compartilhar links exclusivos pelo WhatsApp.
- Permitir que qualquer pessoa com o link válido preencha e assine o documento.
- Capturar assinaturas desenhadas com mouse ou touchscreen.
- Gerar o PDF final com as informações preenchidas e a assinatura.
- Registrar evidências técnicas da assinatura.
- Permitir que funcionários confiram os dados informados com o cadastro interno da empresa.
- Consultar documentos antigos.
- Baixar PDFs originais e assinados.
- Visualizar o histórico completo das solicitações.
- Gerenciar funcionários e permissões.
- Preservar documentos e registros de auditoria.

O sistema deve ser pensado para uso real por uma equipe de suporte técnico, que precisa obter autorizações de clientes para manutenções, conversões de banco de dados, exclusões de registros e outros procedimentos.

## 2. Stack obrigatória

### Frontend

- Next.js com App Router.
- React.
- TypeScript.
- Tailwind CSS v4.
- shadcn/ui.
- Lucide React.
- React Hook Form.
- Zod.
- TanStack Query.
- PDF.js para visualização de documentos.
- Signature Pad ou biblioteca equivalente para assinatura desenhada.

### Backend

- NestJS.
- TypeScript.
- API REST.
- Validação de entradas.
- Autenticação dos funcionários por sessão segura.
- Autorização baseada em permissões.
- Swagger/OpenAPI para documentação.
- Logging estruturado.

### Banco de dados

- Neon PostgreSQL.
- Drizzle ORM.
- Drizzle Kit para migrations.

### Armazenamento

- Neon Storage para armazenar PDFs originais, preenchidos, assinados e pacotes de evidências.
- Criar uma camada de abstração para armazenamento, permitindo trocar o provedor futuramente.
- Antes da implementação, verificar a documentação atual do Neon Storage e suas APIs.
- Não presumir recursos de privacidade, versionamento ou retenção sem confirmação.
- Não armazenar PDFs permanentemente no filesystem da Vercel.
- Nunca expor credenciais do armazenamento ao navegador.

### Infraestrutura

A arquitetura deverá ser compatível com hospedagem futura na Vercel, utilizando projetos separados para frontend e backend.

Não utilizar:

- Docker.
- Docker Compose.
- C#.
- Redis como dependência obrigatória.
- VPS como requisito.
- Serviços de envio de e-mail.
- WhatsApp Business API.
- Serviços pagos de assinatura eletrônica.

**Não realizar deploy.**

Não executar comandos de publicação na Vercel, não criar projetos de hospedagem e não configurar domínio em produção.

O desenvolvimento deverá funcionar localmente, e eu realizarei o deploy manualmente posteriormente.

## 3. Estrutura do repositório

Utilizar um monorepositório com npm workspaces.

Estrutura sugerida:

```text
signflow/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── providers/
│   │   │   ├── services/
│   │   │   └── types/
│   │   ├── public/
│   │   ├── package.json
│   │   └── next.config.ts
│   │
│   └── api/
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── common/
│       │   ├── config/
│       │   ├── database/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── clients/
│       │   │   ├── templates/
│       │   │   ├── documents/
│       │   │   ├── signature-requests/
│       │   │   ├── signing/
│       │   │   ├── pdf/
│       │   │   ├── storage/
│       │   │   ├── audit/
│       │   │   ├── verification/
│       │   │   └── settings/
│       │   └── shared/
│       ├── drizzle/
│       ├── package.json
│       └── nest-cli.json
│
├── packages/
│   ├── shared/
│   │   └── src/
│   └── config/
│
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── api.md
│   ├── security.md
│   └── deployment.md
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

A estrutura poderá ser refinada quando houver justificativa técnica.

Separar claramente regras de negócio, controllers, services, repositories, DTOs e validações.

Não concentrar toda a lógica em arquivos gigantes.

## 4. Design e identidade visual

Criar uma interface moderna, profissional, minimalista e responsiva.

A identidade visual deverá utilizar:

- Tema escuro como padrão.
- Possibilidade de alternar entre tema claro e escuro.
- Tons neutros e superfícies discretas.
- Azul como cor principal de destaque.
- Bordas sutis.
- Cantos moderadamente arredondados.
- Ícones Lucide.
- Tipografia moderna.
- Animações leves.
- Skeletons durante carregamentos.
- Toasts para feedback.
- Modais de confirmação.
- Estados vazios bem projetados.
- Layout adaptado para desktop, tablet e celular.

Evitar gradientes excessivos, elementos decorativos desnecessários e aparência genérica de template.

O painel administrativo terá sidebar recolhível e cabeçalho superior.

O portal público de assinatura terá uma interface própria, simplificada e otimizada para celulares.

Todas as telas deverão estar em português brasileiro.

## 5. Autenticação dos funcionários

Implementar autenticação completa para usuários internos.

Funcionalidades:

- Login por usuário ou e-mail corporativo e senha.
- Hash seguro de senhas com Argon2id.
- Sessões seguras com cookies HttpOnly, Secure em produção e SameSite apropriado.
- Proteção contra CSRF quando aplicável.
- Logout.
- Expiração e revogação de sessões.
- Limitação de tentativas de login.
- Alteração de senha.
- Cadastro de funcionários por administradores.
- Ativação e desativação de usuários.
- Registro de acessos relevantes.

Não implementar cadastro público de funcionários.

Criar um comando CLI para provisionar o primeiro administrador, utilizando variáveis de ambiente ou entrada segura de credenciais.

Não utilizar credenciais administrativas fixas no código.

### Perfis

**Administrador**

Acesso a todas as funcionalidades, usuários, configurações e auditoria.

**Funcionário**

Pode gerenciar clientes, modelos e solicitações conforme suas permissões.

**Auditor**

Pode consultar documentos, registros e evidências, sem alterar documentos ou criar assinaturas.

Aplicar as permissões no backend, não apenas escondendo elementos na interface.

## 6. Dashboard

Criar a rota:

`/dashboard`

Exibir:

- Total de solicitações.
- Documentos aguardando assinatura.
- Documentos visualizados.
- Documentos assinados.
- Documentos aguardando conferência.
- Documentos conferidos.
- Documentos com divergências.
- Documentos expirados.
- Documentos cancelados.
- Solicitações recentes.
- Atividades recentes.
- Evolução de assinaturas por período.

Permitir filtros por período e responsável.

Os indicadores devem ser obtidos do banco de dados real.

Cada indicador deverá permitir navegar para a listagem filtrada correspondente.

## 7. Cadastro de clientes

Criar a rota:

`/clientes`

Implementar CRUD completo.

Campos:

- Identificador interno.
- Nome ou razão social.
- Nome fantasia.
- CPF/CNPJ, conforme o tipo de cadastro.
- Telefone.
- WhatsApp.
- Código interno da empresa.
- Observações.
- Data de cadastro.
- Status ativo/inativo.

Não exigir e-mail.

Implementar:

- Pesquisa.
- Paginação.
- Ordenação.
- Filtros.
- Validação de CPF/CNPJ.
- Prevenção de duplicidades conforme regras de negócio.
- Visualização do histórico de documentos do cliente.

O cadastro deverá permitir associar múltiplas solicitações ao mesmo cliente.

## 8. Modelos de documentos

Criar:

- `/modelos`
- `/modelos/novo`
- `/modelos/[id]`
- `/modelos/[id]/editar`

O funcionário poderá enviar um PDF e transformá-lo em modelo reutilizável.

### Editor visual

Implementar um editor real, com PDF.js, permitindo:

- Visualizar todas as páginas.
- Navegar entre páginas.
- Ajustar zoom.
- Selecionar campos.
- Arrastar campos.
- Redimensionar campos.
- Excluir campos.
- Configurar propriedades.
- Definir obrigatoriedade.
- Pré-visualizar o resultado.
- Salvar alterações.

Tipos de campo:

- Texto.
- Nome completo.
- CPF.
- CNPJ.
- Data.
- Número.
- Telefone.
- Texto longo.
- Checkbox.
- Seleção.
- Assinatura.

Cada campo deverá possuir:

- Identificador único.
- Nome interno.
- Rótulo.
- Tipo.
- Página.
- Coordenadas.
- Dimensões.
- Obrigatoriedade.
- Valor padrão opcional.
- Regras de validação.
- Indicação de preenchimento pelo funcionário ou signatário.

Utilizar coordenadas normalizadas ou outra estratégia robusta para garantir que os campos mantenham a posição correta independentemente do zoom e do tamanho da tela.

O editor deve permitir trabalhar com documentos de múltiplas páginas.

### Versionamento

Cada modelo publicado deverá possuir uma versão imutável.

Alterações posteriores deverão criar novas versões.

Solicitações antigas continuarão vinculadas à versão original do modelo.

Não permitir que a edição de um modelo altere documentos já enviados ou assinados.

## 9. Solicitações de assinatura

Criar:

- `/documentos`
- `/documentos/novo`
- `/documentos/[id]`

O funcionário poderá criar uma solicitação usando um modelo existente ou enviando um PDF avulso.

### Campos da solicitação

- Título.
- Cliente.
- Signatário esperado.
- Descrição do serviço.
- Número do chamado.
- Modelo ou PDF.
- Prazo de validade.
- Observações internas.
- Responsável pela solicitação.

O número do chamado deverá ser pesquisável.

### Criação

Implementar um fluxo em etapas:

1. Seleção do documento.
2. Seleção do cliente.
3. Identificação do signatário esperado.
4. Preenchimento dos dados internos.
5. Configuração dos campos, quando necessário.
6. Revisão do documento.
7. Confirmação e geração do link.

Após confirmar, gerar uma versão imutável do documento-base e um link exclusivo de assinatura.

O link deverá utilizar um token criptograficamente seguro e imprevisível.

Armazenar apenas o hash do token no banco.

Permitir:

- Copiar link.
- Compartilhar pelo WhatsApp.
- Consultar solicitação.
- Cancelar solicitação.
- Definir nova validade quando permitido.
- Revogar link.
- Criar uma nova solicitação a partir de outra.

Não permitir modificar silenciosamente um documento já enviado.

Se o conteúdo precisar mudar, criar nova versão ou nova solicitação e invalidar o link anterior.

## 10. Compartilhamento pelo WhatsApp

O compartilhamento será manual.

Não integrar a WhatsApp Business API.

Criar botão:

**Enviar pelo WhatsApp**

Ao clicar, abrir uma URL `wa.me` ou mecanismo equivalente, contendo:

- Número do cliente, quando disponível.
- Mensagem predefinida.
- Nome do documento.
- Nome da empresa.
- Link exclusivo de assinatura.

Utilizar codificação correta da URL.

O funcionário deverá confirmar o envio no próprio WhatsApp.

Também implementar:

**Copiar link**

e

**Copiar mensagem**

Permitir personalizar o texto padrão nas configurações.

Não registrar a mensagem como entregue apenas porque o funcionário clicou no botão.

## 11. Portal público de assinatura

Criar a rota:

`/assinar/[token]`

Essa página será pública e não exigirá login.

**Qualquer pessoa que possua o link válido poderá preencher e assinar o documento.**

Não implementar:

- OTP.
- Verificação por e-mail.
- Verificação por SMS.
- Verificação pelo WhatsApp.
- Gov.br.
- Reconhecimento facial.
- Validação biométrica.
- Cadastro do cliente.
- Senha para assinatura.

### Interface

Exibir:

- Identificação da empresa solicitante.
- Título do documento.
- Descrição.
- Prazo de validade.
- Visualização integral do PDF.
- Campos editáveis.
- Identificação declarada do signatário.
- Área de assinatura.
- Declaração de concordância.
- Botão de confirmação.

O cliente poderá preencher os campos pelo celular ou computador.

### Assinatura desenhada

Implementar um canvas funcional para assinatura usando mouse ou touchscreen.

Permitir:

- Desenhar.
- Limpar.
- Refazer.
- Visualizar.
- Confirmar.

A assinatura deverá ser incorporada ao PDF final na posição definida pelo modelo.

Não permitir envio de assinatura vazia.

### Confirmação

Antes de finalizar, exibir uma revisão do documento com os dados preenchidos.

Exigir checkbox de concordância explícita.

Exemplo:

"Declaro que li o documento apresentado, concordo com seu conteúdo e desejo assiná-lo eletronicamente."

O texto da declaração e sua versão deverão ser armazenados.

A assinatura só poderá ser confirmada após o aceite.

O backend deverá validar todos os campos e o estado da solicitação.

### Conclusão

Após assinar:

- Registrar a assinatura.
- Gerar o PDF final.
- Persistir as evidências.
- Atualizar o status.
- Exibir confirmação.
- Permitir baixar o PDF assinado.

Não enviar nenhum e-mail.

## 12. Estados dos documentos

Implementar uma máquina de estados consistente.

Estados principais:

- Rascunho.
- Aguardando assinatura.
- Visualizado.
- Em preenchimento.
- Assinatura em processamento.
- Assinado — aguardando conferência.
- Conferido.
- Dados divergentes.
- Recusado.
- Expirado.
- Cancelado.
- Falha de processamento.

Evitar transições inválidas.

O backend será responsável por controlar as transições.

Utilizar transações de banco e operações idempotentes para impedir assinaturas duplicadas.

Não considerar uma assinatura concluída antes de garantir que os arquivos e as evidências essenciais tenham sido persistidos.

Caso ocorra uma falha na geração do PDF ou armazenamento, registrar o problema e permitir recuperação segura, sem duplicar assinaturas.

## 13. Conferência interna da assinatura

Esta funcionalidade é obrigatória.

Depois que alguém assinar um documento, o status será:

**Assinado — Aguardando conferência**

Um funcionário deverá abrir o documento e comparar as informações fornecidas com o cadastro interno da empresa.

Exibir lado a lado:

**Dados do cadastro**

- Cliente.
- Nome do responsável esperado.
- CPF, quando disponível.
- Empresa.
- Informações internas relevantes.

**Dados informados na assinatura**

- Nome declarado.
- CPF declarado, quando solicitado.
- Data e hora.
- Dados do documento.
- Assinatura desenhada.

Criar ações:

**Dados conferem**

**Dados divergentes**

Ao marcar como conferido:

- Registrar funcionário.
- Data e hora.
- Resultado.
- Observações opcionais.

Em caso de divergência:

- Exigir uma justificativa.
- Registrar o resultado.
- Destacar a solicitação para revisão.

A conferência não deverá alterar o PDF já assinado.

Não permitir apagar o resultado anterior da auditoria. Se houver uma nova conferência, registrar um novo evento preservando o histórico.

**IMPORTANTE:** essa conferência representa apenas a comparação dos dados com o cadastro interno. Não afirmar que ela comprova a identidade civil do signatário.

## 14. Manipulação de PDFs

Implementar serviços para:

- Validar uploads.
- Inspecionar PDFs.
- Rejeitar arquivos inválidos.
- Definir limites de tamanho e páginas.
- Armazenar o original.
- Renderizar páginas.
- Posicionar campos.
- Preencher informações.
- Incorporar assinatura desenhada.
- Gerar documento final.
- Calcular hashes SHA-256.
- Gerar comprovante de evidências.
- Baixar arquivos de forma autenticada ou autorizada.

Preservar o PDF original sem modificações.

O PDF assinado deverá conter:

- Conteúdo integral.
- Campos preenchidos.
- Representação visual da assinatura.
- Identificador da solicitação.
- Informações de assinatura, conforme layout definido.

O sistema poderá adicionar uma página de comprovante ao final, sem substituir o conteúdo original.

Evitar bibliotecas que exijam licenças comerciais incompatíveis com o projeto.

Verificar as licenças antes de escolher dependências.

## 15. Evidências e auditoria

Cada assinatura deverá produzir um conjunto estruturado de evidências.

Registrar, quando disponíveis e necessários:

- Identificador da solicitação.
- Identificador do documento.
- Versão do documento.
- Nome declarado.
- CPF declarado, se aplicável.
- Data e hora de abertura.
- Data e hora do aceite.
- Data e hora da assinatura.
- IP observado pelo backend.
- User-Agent.
- Texto e versão da declaração aceita.
- Hash do PDF original.
- Hash do PDF apresentado para assinatura.
- Hash do PDF final.
- Identificador da transação.
- Eventos relevantes do processo.

Não armazenar tokens de acesso em texto puro nos logs.

Não registrar dados pessoais desnecessários.

Utilizar eventos de auditoria append-only, com mecanismos de detecção de alterações.

Gerar um pacote de evidências contendo um manifesto estruturado, identificadores, eventos relevantes e hashes.

Proteger o pacote contra alterações não autorizadas.

O sistema não deverá alegar que a assinatura é qualificada, ICP-Brasil ou que comprova definitivamente a identidade do signatário.

## 16. Tela de detalhes do documento

Criar uma página completa com abas:

### Detalhes

- Cliente.
- Responsável.
- Documento.
- Chamado.
- Datas.
- Status.
- Link e validade.
- Informações da solicitação.

### Documento

- Visualização do PDF.
- Download do original.
- Download do assinado, quando disponível.

### Histórico

- Linha do tempo.
- Eventos.
- Datas.
- Responsáveis.
- Mudanças de status.

### Evidências

- Identificação declarada.
- Informações técnicas.
- Hashes.
- Comprovante.
- Download do pacote.

### Conferência

- Comparação de dados.
- Resultado.
- Histórico de conferências.
- Ações autorizadas conforme perfil.

## 17. Verificação de integridade

Criar uma funcionalidade de verificação de documentos.

O sistema deverá permitir:

- Consultar um identificador.
- Enviar um PDF para comparar seu hash.
- Verificar correspondência com um arquivo registrado.
- Exibir o resultado da verificação.

Não expor dados pessoais ou o conteúdo completo dos documentos em consultas públicas.

A página pública deverá revelar apenas informações mínimas e não sensíveis, quando necessário.

O acesso a evidências detalhadas deverá exigir autorização.

Diferenciar claramente:

- Integridade do arquivo.
- Existência de registro no SignFlow.
- Identidade declarada.
- Conferência cadastral interna.

Não apresentar essas verificações como certificação jurídica ou autenticação forte.

## 18. Banco de dados

Criar um schema completo com Drizzle ORM.

Entidades mínimas:

- users
- sessions
- roles
- permissions
- user_roles
- clients
- document_templates
- template_versions
- template_fields
- documents
- document_versions
- signature_requests
- signers
- signatures
- signature_field_values
- document_files
- audit_events
- evidence_packages
- identity_reviews
- app_settings
- processing_jobs

Utilizar UUIDs ou identificadores adequados.

Criar:

- Chaves estrangeiras.
- Constraints.
- Índices.
- Campos de criação e atualização.
- Unicidade quando necessária.
- Relacionamentos.
- Migrations versionadas.

Não salvar arquivos PDF como blobs diretamente no PostgreSQL.

Armazenar referências aos objetos do Neon Storage.

Criar mecanismos para impedir inconsistências entre banco e armazenamento.

## 19. Segurança

Implementar:

- Validação de entradas.
- Proteção contra SQL injection.
- Proteção contra XSS.
- CSRF quando aplicável.
- Rate limiting.
- Controle de permissões.
- Cookies seguros.
- CORS restritivo.
- Upload seguro.
- Validação de arquivos.
- Limites de requisição.
- Proteção contra enumeração de documentos.
- Tokens aleatórios e revogáveis.
- Expiração de links.
- Proteção contra replay.
- Transações e idempotência.
- Logs estruturados.
- Tratamento centralizado de erros.
- Gestão segura de segredos.
- URLs de download temporárias e autorizadas.

As rotas públicas devem ter acesso estritamente limitado ao documento associado ao token.

Não permitir listar documentos, clientes ou usuários a partir de uma rota pública.

Evitar expor tokens em logs, ferramentas de analytics ou cabeçalhos Referer.

Aplicar uma política adequada de retenção e tratamento de dados pessoais conforme a LGPD.

## 20. Compatibilidade com Vercel

Embora não seja necessário realizar o deploy, a aplicação deve ser projetada considerando a hospedagem futura na Vercel.

O NestJS deverá ser compatível com execução serverless.

Evitar:

- Processos permanentes em memória.
- Dependência de armazenamento local persistente.
- Jobs infinitos.
- Cron jobs dentro de processos HTTP.
- Estado de sessão em memória.
- Dependência de WebSockets persistentes.

Para tarefas de processamento de PDFs, implementar um mecanismo de jobs duráveis no banco, com execução controlada e recuperação de falhas.

A arquitetura deverá permitir execução por chamadas autenticadas e agendadas futuramente.

Não presumir que qualquer PDF poderá ser processado dentro dos limites de duração e memória da Vercel.

Documentar os limites operacionais e as alternativas necessárias para documentos grandes.

## 21. Configurações

Criar a rota:

`/configuracoes`

Permitir configurar:

- Nome da empresa.
- Logotipo.
- Tema.
- Prazo padrão dos links.
- Mensagem padrão de WhatsApp.
- Limites de upload.
- Texto padrão de concordância.
- Política de retenção.
- Preferências de exibição.
- Parâmetros de segurança administráveis.

Não permitir alterar configurações críticas sem permissão administrativa.

## 22. API REST

Criar endpoints organizados e documentados.

Exemplos:

```text
POST   /auth/login
POST   /auth/logout
GET    /auth/me

GET    /users
POST   /users
PATCH  /users/:id

GET    /clients
POST   /clients
GET    /clients/:id
PATCH  /clients/:id

GET    /templates
POST   /templates
GET    /templates/:id
POST   /templates/:id/versions

GET    /documents
POST   /documents
GET    /documents/:id
GET    /documents/:id/files

POST   /signature-requests
GET    /signature-requests/:id
POST   /signature-requests/:id/cancel
POST   /signature-requests/:id/revoke

GET    /public/sign/:token
POST   /public/sign/:token/prepare
POST   /public/sign/:token/confirm

POST   /documents/:id/reviews

GET    /audit/events
GET    /evidence/:id

POST   /verification/check
```

A estrutura exata poderá ser ajustada para seguir boas práticas REST.

Todas as rotas devem ter validação, tratamento de erros e regras de autorização apropriadas.

## 23. Testes obrigatórios

Implementar testes unitários e de integração para:

- Autenticação.
- Permissões.
- Cadastro de clientes.
- Validação de documentos.
- Criação de modelos.
- Posicionamento dos campos.
- Geração de PDF.
- Geração de links.
- Expiração de tokens.
- Revogação de tokens.
- Preenchimento.
- Assinatura.
- Concorrência e dupla submissão.
- Idempotência.
- Hashes.
- Auditoria.
- Conferência interna.
- Falhas no armazenamento.
- Recuperação de jobs.

Criar testes end-to-end para os principais fluxos do usuário, incluindo:

1. Funcionário cria solicitação.
2. Copia link.
3. Cliente abre o documento.
4. Cliente preenche.
5. Cliente assina.
6. PDF final é gerado.
7. Funcionário consulta.
8. Funcionário confere os dados.
9. Documento fica disponível para consulta posterior.

Utilizar fixtures e arquivos PDF de teste.

Não depender de documentos reais de clientes nos testes.

## 24. Ambiente local

Criar scripts para executar o projeto localmente.

Exemplo:

```bash
npm install
npm run dev
```

O comando de desenvolvimento deverá iniciar frontend e backend.

Criar scripts adicionais:

```bash
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run db:generate
npm run db:migrate
```

Criar um `.env.example` documentado.

O projeto deverá utilizar Neon PostgreSQL e Neon Storage configurados por variáveis de ambiente.

Caso as credenciais ainda não estejam disponíveis, implementar o código de integração completo, documentar as variáveis necessárias e informar claramente quais testes dependem delas.

Não inventar credenciais nem simular sucesso de integrações externas.

## 25. Documentação

Criar um README completo com:

- Visão geral.
- Tecnologias.
- Pré-requisitos.
- Estrutura de pastas.
- Instalação.
- Variáveis de ambiente.
- Configuração do Neon.
- Configuração do armazenamento.
- Migrations.
- Criação do primeiro administrador.
- Execução local.
- Testes.
- Build.
- Resolução de problemas.

Criar também documentação técnica para:

- Arquitetura.
- Banco de dados.
- API.
- Segurança.
- Processamento de PDFs.
- Fluxo de assinatura.
- Auditoria.
- Conferência interna.
- Preparação para deploy manual.

A documentação de deploy deverá ser apenas instrutiva.

**Não executar nenhum deploy.**

## 26. Regras de implementação

Siga rigorosamente estas orientações:

1. Desenvolva o projeto completo, não apenas um MVP visual.
2. Utilize código real e funcional.
3. Não deixe botões sem ação.
4. Não utilize mocks como substitutos de funcionalidades reais.
5. Não utilize dados fictícios permanentes.
6. Não crie endpoints que apenas retornem respostas simuladas.
7. Não utilize `TODO` para funcionalidades essenciais.
8. Não implemente OTP ou qualquer verificação por e-mail.
9. Não implemente login para o cliente.
10. Não integre APIs do WhatsApp.
11. Não utilize Docker.
12. Não utilize C#.
13. Não faça deploy.
14. Não modifique recursos externos sem necessidade.
15. Mantenha frontend e backend separados.
16. Priorize segurança e consistência dos dados.
17. Utilize TypeScript com tipagem rigorosa.
18. Centralize contratos e validações compartilhadas quando adequado.
19. Implemente loading, erro, vazio e sucesso em todas as telas.
20. Não considere uma funcionalidade concluída sem testar seu comportamento.

## 27. Ordem de desenvolvimento

Implemente o projeto em etapas, mantendo a aplicação compilável.

**Etapa 1 — Fundação**

- Monorepo.
- Next.js.
- NestJS.
- Tailwind.
- shadcn/ui.
- Drizzle.
- Neon.
- Configurações.
- Autenticação.

**Etapa 2 — Painel administrativo**

- Layout.
- Sidebar.
- Dashboard.
- Usuários.
- Clientes.
- Permissões.

**Etapa 3 — Documentos e modelos**

- Upload.
- Armazenamento.
- Editor visual.
- Campos.
- Versionamento.
- Listagens.

**Etapa 4 — Solicitações**

- Criação.
- Links exclusivos.
- Expiração.
- Cancelamento.
- Compartilhamento por WhatsApp.

**Etapa 5 — Assinatura pública**

- Visualização.
- Preenchimento.
- Assinatura desenhada.
- Aceite.
- Finalização.

**Etapa 6 — PDFs e evidências**

- Geração.
- Hashes.
- Auditoria.
- Armazenamento.
- Downloads.
- Verificação de integridade.

**Etapa 7 — Conferência**

- Comparação cadastral.
- Aprovação.
- Divergências.
- Histórico.

**Etapa 8 — Finalização**

- Testes.
- Correções.
- Segurança.
- Responsividade.
- Documentação.
- Build final.

Não interrompa a implementação após criar apenas a estrutura de pastas.

Sempre que possível, continue automaticamente para a próxima etapa.

Se encontrar problemas de compilação, tipagem, dependências ou testes, corrija-os antes de avançar.

## 28. Critérios de conclusão

O projeto estará concluído quando:

- O funcionário conseguir fazer login.
- O administrador conseguir cadastrar funcionários.
- O funcionário conseguir cadastrar clientes.
- O funcionário conseguir enviar um PDF.
- O funcionário conseguir criar um modelo com campos.
- O funcionário conseguir gerar uma solicitação.
- O sistema gerar um link exclusivo.
- O funcionário conseguir compartilhar pelo WhatsApp.
- O cliente conseguir abrir o link sem login.
- O cliente conseguir preencher os campos.
- O cliente conseguir desenhar sua assinatura.
- O cliente conseguir confirmar o aceite.
- O sistema gerar e armazenar o PDF final.
- O sistema preservar as evidências.
- O funcionário conseguir consultar o documento.
- O funcionário conseguir conferir os dados cadastrais.
- O funcionário conseguir baixar o documento.
- O auditor conseguir consultar o histórico.
- O sistema impedir acessos não autorizados.
- Os testes principais passarem.
- O frontend e o backend compilarem.
- A documentação estiver completa.

Ao finalizar, apresente:

1. Resumo das funcionalidades implementadas.
2. Estrutura final de pastas.
3. Tecnologias e versões utilizadas.
4. Variáveis de ambiente necessárias.
5. Comandos para instalar e executar.
6. Comandos para migrations.
7. Procedimento para criar o primeiro administrador.
8. Resultado dos testes e do build.
9. Limitações conhecidas.
10. Pendências que dependam de credenciais ou configuração externa.

Não afirme que algo foi testado ou implementado caso não tenha sido.

**Comece agora criando o projeto SignFlow e implementando todas as etapas descritas.**
