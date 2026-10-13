# Arquitetura

Next.js App Router entrega painel e portal separados. TanStack Query gerencia consultas e invalidação; RHF/Zod valida formulários; os mesmos contratos são validados pela API. Tailwind v4 e componentes shadcn/Radix compõem controles. PDF.js é importado somente no navegador, com worker local da mesma versão.

NestJS organiza controllers, serviços e repositório de documentos. A conexão node-postgres mantém até quatro conexões com timeout; Drizzle define schema/migrations. SQL de operações críticas é parametrizado e roda no mesmo PostgreSQL. O provider de armazenamento é abstrato; S3/Neon é o adaptador real. Estado de autenticação, rate limiting e jobs vive no banco, nunca somente na instância HTTP.

Requisições internas passam por guarda de origem, sessão, CSRF e permissões. Rotas públicas possuem apenas a capacidade do token de uma solicitação. `/jobs/run` possui autorização independente por segredo e não aceita credenciais de funcionário como substituto.

Templates publicados são imutáveis. A criação incorpora valores internos a um novo PDF-base, persiste objeto e registra sua referência em transação. A confirmação grava assinatura/valores/aceite/job atomicamente sob bloqueio da solicitação. O worker valida arquivos, gera PDF com comprovante, preserva PNG e manifesto, verifica leitura/hash e somente então confirma o estado assinado.

Não existe transação distribuída entre PostgreSQL e S3. A estratégia é gravar primeiro os objetos e depois publicar referências; uma falha pode deixar objetos órfãos, mas nunca um documento assinado disponível sem evidências. Chaves por tentativa impedem que workers com lease perdida sobrescrevam arquivos publicados.
