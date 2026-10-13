# Segurança e tratamento de dados

Argon2id (19 MiB, duas iterações, paralelismo 1), mínimo 9 caracteres. Sessão aleatória de 256 bits em cookie HttpOnly, SameSite=Strict, Secure em produção e duração configurável. Senha alterada e acesso desativado revogam sessões. Origem exata + cabeçalho CSRF protegem mutações internas. O backend aplica permissões em toda rota interna; o auditor não recebe escrita, inclusive por permissão adicional.

Tokens públicos são aleatórios, armazenados somente como hashes, revogáveis e expiráveis. Renovar troca o token. Não há autenticação civil do signatário. PDF.js não executa scripts dos documentos; uploads rejeitam criptografia, nomes/ações JavaScript/Launch/EmbeddedFile/RichMedia/XFA e conteúdo ativo reconhecido. Isso é inspeção estrutural, não antivírus. PNG passa por CRC, dimensões, limite de bytes e quantidade mínima de pixels com tinta antes de aceitação.

Rate limits persistentes por IP/hash do usuário reduzem abuso, inclusive entre instâncias. Configure proxy confiável somente quando a hospedagem garantir a origem de X-Forwarded-For; caso contrário mantenha false. Limpeza periódica de rate_limits e sessões expiradas precisa preservar eventos e a política de retenção.

SQL usa parâmetros; React escapa texto; não há HTML arbitrário ou avaliação de regex de usuário. Headers bloqueiam framing, sniffing, referências e cache de páginas sensíveis. Next não registra URLs de requisição em desenvolvimento. Não adicionar analytics ao portal. Revise logs HTTP da plataforma para impedir tokens em observabilidade/URLs após hospedagem; o código não controla os access logs do provedor.

Storage é privado e suas credenciais ficam no backend. Verificamos SHA-256 após upload e leitura. ACLs/versionamento/lifecycle S3 não são alterados pela aplicação. HMAC de manifesto e cadeia exige segredo separado preservado em backup seguro. Triggers append-only preservam trilha de conferência e versões. Um administrador com banco + segredo não é impedido de adulterar tudo: carimbo externo/WORM não fazem parte deste sistema.

A política de retenção não apaga automaticamente dados. A empresa deve estabelecer base legal, finalidade, acesso e prazos conforme seu contexto e a LGPD, com procedimentos documentados de direitos dos titulares e expurgo autorizado. IP, User-Agent limitado, declarações e hashes têm finalidade de evidência técnica. A consulta pública só informa existência e correspondência de hash; dados pessoais ficam restritos.

Cadastro de funcionários: `/cadastro` e `POST /auth/register` recebem somente nome, login e senha. A senha mínima é de 9 caracteres em cadastro, provisionamento e alteração. O cadastro público fixa o perfil `employee`, sem permissões administrativas, rejeita campos extras e limita tentativas por IP. A criação do primeiro administrador permanece na CLI, sob bloqueio de provisionamento. Logins são normalizados para minúsculas e a constraint única impede duplicidades.
