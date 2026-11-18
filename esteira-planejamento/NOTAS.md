# 02.02 Esteira de Planejamento (app 12703980)

Origem: Vibe 10551860 (versão LIVE em 14/11/2026). Versão v1 20111849 (live, promovida em 14/11/2026), feature 129159264 (AppFeatureBoardView), aba 292153406 no quadro 02.01 Projetos em Planejamento (18412010674).
Servidor: https://c3620-service-29669755-e35ce35b.us.monday.app (Document DB). Variáveis: CLIENT_SECRET, MONDAY_API_TOKEN.
Quadros lidos: 02.01 Projetos em Planejamento 18412010674 (leitura e escrita), Mapa de Gerentes de Projeto 18422833691 (só leitura). Mapa de colunas em server/columns.json (chaves no padrão do BoardSDK do Vibe; gerado pelas colunas do quadro, com ajuste manual de SaldoEquipe/SaldoInsumos/SaldoTotal e email).
Coleções no banco: aloc_ajustes, aloc_acoes, aloc_comentarios, aloc_projecoes, aloc_historico, aloc_import_pendentes, aloc_regra_capacidade, snapshots_semanais. Os dados do Vibe não vieram junto.
Gravações no 02.01 saem com o token de serviço (MONDAY_API_TOKEN); a autoria no registro de ações vem do sessionToken.

Shims: server/boardSdk.ts (BoardSDK sobre GraphQL, filtro por grupo, users.me, página de 100 quando há fórmula), server/apiClient.ts, server/vibeDb.ts (cursor com ordenação, aggregate/groupBy/count), src/shims/vibe-db-client.ts (TanStack Query, chaves com prefixo 'vibedb'), src/shims/react-router.ts (aba/sub/per na query string com a validação da rota do Vibe), src/shims/pptx-export.ts (pptxgenjs).

Build: `npm i --legacy-peer-deps && npm run build`; em deploy/: `npm i --package-lock-only`; publicar com `mapps code:push -a 12703980 -i 20376895 -d deploy -f`.

OAuth: o servidor usa o token OAuth do app guardado no banco (coleção app_oauth), autorizado uma vez por um admin em https://live1-service-29669755-e35ce35b.us.monday.app/oauth/start; redirect URL cadastrada no Developer Center: https://live1-service-29669755-e35ce35b.us.monday.app/oauth/callback. Situação em .../oauth/status. Versão v2 (20376895) criada em 18/11/2026 com os escopos do OAuth (v1 20111849 ficou bloqueada); publicar com -i 20376895. MONDAY_API_TOKEN fica só como reserva enquanto o app não estiver autorizado.

Gravações: toda mutation pedida por uma função chamada pela tela é executada no navegador de quem usa o app (server/relay.ts + src/shims/react-start-client.ts, coleção app_mutacoes), então fica no nome dessa pessoa e ninguém precisa de token. Agendamentos e rotinas que continuam depois da resposta gravam com o token OAuth do app.
