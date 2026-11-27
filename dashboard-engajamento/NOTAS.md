# Dashboard de Engajamento (app 12685411)

Origem: Vibe 10555564. Servidor: https://fe29b-service-29669755-e1dd88e7.us.monday.app (Document DB do monday code).

Variáveis no monday code: CLIENT_SECRET, MONDAY_API_TOKEN, CRON_KEY.
Agendamentos: consolidacaosemanal (segunda 14h10 de Brasília, cron 10 17 * * 1, /mndy-cronjob/weekly) e acessosdiarios (sem efeito desde 13/11/2026).

Visualização (aba do app): "Dashboard de Engajamento", view 294294344 no quadro Relatórios dos projetos - Monday (18420326098), feature 128993330. Desde 27/11/2026; antes ficava no quadro 18439727709.

Abas: Engajamento (só pessoas em equipe de projeto), DGPE (todos, por departamento), Painel do Gerente, Comunicação, Meu Perfil, Base, Atualizar Painel.

Nomenclatura semanal: Engajado (acesso na semana), Desengajado (mais de 7 dias sem acesso), Inativo (mais de 30 dias ou nunca acessou), Afastado. Dia padrão da análise: segunda à tarde, sobre a semana anterior (domingo a sábado).

APUS e atualizações por projeto: lidos do quadro Relatórios dos projetos (18420326098), grupo Equipes - Por Semana, com cache de 30 min na coleção apus_cache (server/apus.ts). APUS = fórmula do quadro, (atualizações acumuladas ÷ usuários) ÷ semanas na plataforma; mínimo esperado 1, máximo 2. Aparece na aba Comunicação e, filtrado pelos projetos do gerente, no Painel do Gerente.

Comunicação: semana de domingo a sábado, com o número "Semana N" dos grupos do quadro Análise de Engajamento (18436474473), lido de base_week_status. Linhas na coleção comm_weeks_v2 e no quadro 18439727709, um grupo por semana. Código em server/communication.ts e src/generated/server/communication.ts.

OAuth: o servidor usa o token OAuth do app guardado no banco (coleção app_oauth), autorizado uma vez por um admin em https://live1-service-29669755-e1dd88e7.us.monday.app/oauth/start; redirect URL cadastrada no Developer Center: https://live1-service-29669755-e1dd88e7.us.monday.app/oauth/callback. Situação em .../oauth/status. Versão v2 (20379920) criada em 18/11/2026 com os escopos do OAuth (v1 20036795 ficou bloqueada); publicar com -i 20379920. MONDAY_API_TOKEN fica só como reserva enquanto o app não estiver autorizado.

Gravações: toda mutation pedida por uma função chamada pela tela é executada no navegador de quem usa o app (server/relay.ts + src/shims/react-start-client.ts, coleção app_mutacoes), então fica no nome dessa pessoa e ninguém precisa de token. Agendamentos e rotinas que continuam depois da resposta gravam com o token OAuth do app.
