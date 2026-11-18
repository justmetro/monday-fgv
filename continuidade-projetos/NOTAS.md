# Continuidade de Projetos (app 12688562)

Origem: Vibe 10557100. Versão live v1 (20049935), feature 129022313, aba no quadro Equipes Revisadas (18437180615).
Servidor: https://e9432-service-29669755-df0a7511.us.monday.app (Document DB). Variáveis: CLIENT_SECRET, MONDAY_API_TOKEN.
Quadros lidos: Histórico de Projetos 18399249920, Levantamento de Produtos 18398687489, Decisões do Vibe 18436640715, Equipes Revisadas 18437180615 (mapa de colunas em server/columns.json).

Build: `npm i --legacy-peer-deps && npm run build`; em deploy/: `npm i --package-lock-only`; publicar com `mapps code:push -a 12688562 -i <versão> -d deploy -f`.

OAuth: o servidor usa o token OAuth do app guardado no banco (coleção app_oauth), autorizado uma vez por um admin em <servidor>/oauth/start; redirect URL cadastrada no Developer Center: <servidor>/oauth/callback. Situação em <servidor>/oauth/status. MONDAY_API_TOKEN fica só como reserva enquanto o app não estiver autorizado.
