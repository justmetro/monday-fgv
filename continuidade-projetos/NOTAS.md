# Continuidade de Projetos (app 12688562)

Origem: Vibe 10557100. Versão live v1 (20049935), feature 129022313, aba no quadro Equipes Revisadas (18437180615).
Servidor: https://e9432-service-29669755-df0a7511.us.monday.app (Document DB). Variáveis: CLIENT_SECRET, MONDAY_API_TOKEN.
Quadros lidos: Histórico de Projetos 18399249920, Levantamento de Produtos 18398687489, Decisões do Vibe 18436640715, Equipes Revisadas 18437180615 (mapa de colunas em server/columns.json).

Build: `npm i --legacy-peer-deps && npm run build`; em deploy/: `npm i --package-lock-only`; publicar com `mapps code:push -a 12688562 -i <versão> -d deploy -f`.

OAuth: o servidor usa o token OAuth do app guardado no banco (coleção app_oauth), autorizado uma vez por um admin em https://live1-service-29669755-df0a7511.us.monday.app/oauth/start; redirect URL cadastrada no Developer Center: https://live1-service-29669755-df0a7511.us.monday.app/oauth/callback. Situação em .../oauth/status. Versão v2 (20379669) criada em 18/11/2026 com os escopos do OAuth (v1 20049935 ficou bloqueada); publicar com -i 20379669. MONDAY_API_TOKEN fica só como reserva enquanto o app não estiver autorizado.

Gravações: toda mutation pedida por uma função chamada pela tela é executada no navegador de quem usa o app (server/relay.ts + src/shims/react-start-client.ts, coleção app_mutacoes), então fica no nome dessa pessoa e ninguém precisa de token. Agendamentos e rotinas que continuam depois da resposta gravam com o token OAuth do app.
