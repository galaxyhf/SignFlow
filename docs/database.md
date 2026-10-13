# Banco de dados

O schema está em `apps/api/src/database/schema.ts`; migrations em `apps/api/drizzle`. Use conexão direta para `db:migrate` e pooled para operações. Nunca altere uma migration já aplicada; mudanças posteriores devem ter novo número.

Identidades: users, roles, permissions, role_permissions, user_roles, user_permissions, sessions, rate_limits. Sessões e tokens são hashes SHA-256 de valores aleatórios de 256 bits. Clientes têm CPF/CNPJ e código interno únicos; exclusão significa desativação preservando histórico.

Modelos: document_templates, template_versions, template_fields. Versão única por modelo; campos usam UUID e definição normalizada. Documentos: documents, document_versions, document_files. Apenas metadados, hashes e referências S3, nunca blobs PDF.

Assinatura: signature_requests, signers, signing_preparations, signatures, signature_field_values, processing_jobs. Uma assinatura por solicitação e uma chave de idempotência por assinatura. Preparações expiram após 30 minutos. Jobs elegíveis são reclamados com `FOR UPDATE SKIP LOCKED`; lease de 3 minutos e token exclusivo controlam conclusão.

Auditoria/conferência: audit_events, evidence_packages, identity_reviews. Configuração: app_settings. Foreign keys protegem referências; índices atendem status, cliente, chamado, hash, auditoria e jobs. Triggers recusam UPDATE/DELETE em eventos, conferências, versões, metadados de arquivos e pacotes de evidências. Não use o usuário proprietário do banco como fronteira final contra adulteração; crie privilégio operacional restrito para a hospedagem futura.

A auditoria usa sequência global protegida por advisory lock e HMAC encadeado. Eventos e transações pertencem ao mesmo commit. Permissões de perfil são inseridas pela migration. Não há cadastros de demonstração.
