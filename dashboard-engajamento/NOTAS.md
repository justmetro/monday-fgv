# Dashboard de Engajamento (app 12685411)

Origem: Vibe 10555564. Servidor: https://fe29b-service-29669755-e1dd88e7.us.monday.app (Document DB do monday code).

Variáveis no monday code: CLIENT_SECRET, MONDAY_API_TOKEN, CRON_KEY.
Agendamentos: consolidacaosemanal (segunda 6h10 de Brasília, /mndy-cronjob/weekly) e acessosdiarios (sem efeito desde 13/11/2026).

Abas: Engajamento, Painel do Gerente, Comunicação, Meu Perfil, Base, Atualizar Painel.

Comunicação: semana de domingo a sábado, com o número "Semana N" dos grupos do quadro Análise de Engajamento (18436474473), lido de base_week_status. Linhas na coleção comm_weeks_v2 e no quadro 18439727709, um grupo por semana. Código em server/communication.ts e src/generated/server/communication.ts.
