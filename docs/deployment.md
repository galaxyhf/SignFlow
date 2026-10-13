# Preparação para hospedagem manual

Nenhum comando de deploy foi executado. A configuração local é desenvolvimento; não publique `.env`, dados de teste ou segredos.

Frontend e backend são projetos separados. Frontend: root apps/web, Next.js, Node 24, instalação npm workspaces pela raiz, build npm run build -w @signflow/web. Backend: root apps/api, função Node de entrada api/index.ts, que inicializa Nest sem listen usando src/serverless.ts. vercel.json encaminha rotas e seleciona duração conservadora de 60 segundos. Confirmar build/importação do monorepo no ambiente Vercel depois do deploy manual; o build tsc local não testa o empacotador serverless.

No frontend configure API_URL como HTTPS do backend. Navegador continua chamando /api no domínio do frontend; isso evita cookies entre domínios diferentes. Backend: WEB_ORIGIN com HTTPS exato do frontend, NODE_ENV=production, segredos, URLs pooled/direct da branch escolhida e Storage privado da mesma branch. Secure e SameSite=Strict nos cookies dependem de HTTPS e desse proxy. Configure TRUST_PROXY somente com cadeia de proxy confiável e teste o IP observado.

Aplicar migrations manualmente em conexão direta após revisão e backup. Criar primeiro administrador pela CLI em ambiente seguro; remover ADMIN_* depois. Nunca usar a branch de E2E ou dados fictícios como produção. Validar região e acesso privado antes de publicar URLs públicas.

O upload é limitado a 3 MiB para deixar margem ao teto HTTP documentado de 4,5 MB. PDF final pode crescer: grandes arquivos devem usar presigned download autorizado, streaming validado ou executor especializado se ultrapassarem limites. Hoje o download passa pela API; medir tamanho final/duração/memória com os documentos operacionais antes de abrir uso. A rotina não garante processamento arbitrário de PDFs dentro da função.

Agendamento futuro: chamada POST /jobs/run com Bearer JOB_SECRET por agendador confiável, uma unidade por chamada. Não há cron dentro do processo. Lease de 3 minutos deve continuar maior que maxDuration+folga; aumente com o orçamento de duração se configurar funções maiores. Não compartilhar segredos de jobs com o navegador.

Checklist após hospedagem: login/logout/CSRF, cookies HTTPS, origem, upload/hash, canvas móvel, PDF revisão, assinatura, retomada após timeout, downloads originais/finais/evidências, permissões do auditor, conferências, private bucket, backup e ausência de tokens em logs/Referrer. Registrar resultados reais. Publicação continua responsabilidade do usuário.

Referência operacional: https://vercel.com/docs/functions/limitations . Recursos e limites do provedor devem ser reconfirmados durante a implantação.
