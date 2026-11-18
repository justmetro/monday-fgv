# Dashboard de Engajamento (app 12685411)

Origem: Vibe 10555564. Servidor: https://fe29b-service-29669755-e1dd88e7.us.monday.app (Document DB do monday code).

Variáveis no monday code: CLIENT_SECRET, MONDAY_API_TOKEN, CRON_KEY.
Agendamentos: consolidacaosemanal (segunda 6h10 de Brasília, /mndy-cronjob/weekly) e acessosdiarios (sem efeito desde 13/11/2026).

Abas: Engajamento, Painel do Gerente, Comunicação, Meu Perfil, Base, Atualizar Painel.

Comunicação: semana de domingo a sábado, com o número "Semana N" dos grupos do quadro Análise de Engajamento (18436474473), lido de base_week_status. Linhas na coleção comm_weeks_v2 e no quadro 18439727709, um grupo por semana. Código em server/communication.ts e src/generated/server/communication.ts.

OAuth: o servidor usa o token OAuth do app guardado no banco (coleção app_oauth), autorizado uma vez por um admin em https://live1-service-29669755-e1dd88e7.us.monday.app/oauth/start; redirect URL cadastrada no Developer Center: https://live1-service-29669755-e1dd88e7.us.monday.app/oauth/callback. Situação em .../oauth/status. Versão v2 (20379920) criada em 18/11/2026 com os escopos do OAuth (v1 20036795 ficou bloqueada); publicar com -i 20379920. MONDAY_API_TOKEN fica só como reserva enquanto o app não estiver autorizado.

Gravações: toda mutation pedida por uma função chamada pela tela é executada no navegador de quem usa o app (server/relay.ts + src/shims/react-start-client.ts, coleção app_mutacoes), então fica no nome dessa pessoa e ninguém precisa de token. Agendamentos e rotinas que continuam depois da resposta gravam com o token OAuth do app.
