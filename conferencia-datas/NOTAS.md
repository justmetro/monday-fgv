# Conferência de Datas de Fim

Painel para a CoPlan pedir aos gerentes a conferência das datas de fim dos projetos (vigência contratual e último produto previsto). Cada gerente vê só os próprios projetos.

## IDs

- App: 12846014
- Versão: v2 20701222 (live). A v1 20698699 ficou sem URL na feature depois de reimportar o manifest.
- Feature: Painel 130430932 na v2 (130425574 na v1)
- Servidor: https://live1-service-29669755-cb23eb9d.us.monday.app
- Quadro de acesso (gerentes como assinantes, só a aba): 18441325686, aba Painel 293737785
- Item usado como alvo das notificações: 13626485007
- Quadro de dados (só CoPlan, gerentes removidos em 24/11/2026): 18441323203 "Conferência de Datas de Fim"
- Fonte das datas: 02.01 Projetos em Planejamento (18412010674), colunas timerange_mm6vw3pb e date_mm5g69fd

## Regras

- CoPlan = donos do quadro de dados. Vê todos os projetos, pede conferência (status Revisar datas + prazo + notificação da monday) e aplica as correções no 02.01.
- Gerente = lido a cada abertura do Mapa de Gerentes (18422833691, grupo Gerentes, coluna "Projetos Gerenciados" ligada ao item do 02.01). Sem ligação no Mapa, vale a coluna Gerente ou "E-mail do gerente" do quadro de dados. Ao pedir conferência, o gerente vira assinante do quadro de acesso. Responde "datas conferidas" ou "datas corrigidas".
- Projetos novos: a rotina diária e cada abertura do painel pela CoPlan incluem no quadro de dados os itens do grupo da esteira do 02.01 (topics) que ainda não estão lá, com vigência e último produto copiados. Os já incluídos não são atualizados. Fica no Histórico como "Projeto novo incluído".
- Leituras e gravações no quadro de dados usam o token OAuth do app (o gerente não acessa esse quadro). A gravação no 02.01 sai pelo navegador de quem aplica (relay).
- CoPlan hoje: Mariana Barbosa Silva, Viviane Pimenta da Silva, Umberto Bezerra Cruz Neto, Arthur de Oliveira Maçaneiro, Mateus Goulart, Alex Shisller e Pedro (donos do quadro de dados).
- Histórico: cada pedido de conferência, confirmação, correção e aplicação no 02.01 fica na coleção `log_conferencia` do banco do app e aparece na aba Histórico (só CoPlan).
- Job `lembrete` (server/jobs.ts) avisa os gerentes com projetos em Revisar datas. Agendamento desligado por enquanto (horário a confirmar com o Pedro).

## Variáveis

- CLIENT_SECRET (Developer Center > app > Basic information)
- CRON_KEY

## OAuth

URL de retorno no manifest: https://live1-service-29669755-cb23eb9d.us.monday.app/oauth/callback. Abrir a aba uma vez e autorizar em /oauth/start (admin). Conferir /oauth/status.

## Build

```
npm i --legacy-peer-deps
npm run build
cd deploy && npm i --package-lock-only && cd ..
mapps code:push -a 12846014 -i <versão> -d deploy
```
