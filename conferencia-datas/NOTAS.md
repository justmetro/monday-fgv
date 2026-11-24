# Conferência de Datas de Fim

Painel para a CoPlan pedir aos gerentes a conferência das datas de fim dos projetos (vigência contratual e último produto previsto). Cada gerente vê só os próprios projetos.

## IDs

- App: 12846014
- Versão: v1 20698699 (live)
- Feature: Painel 130425574 (AppFeatureBoardView)
- Servidor: https://live1-service-29669755-cb23eb9d.us.monday.app
- Quadro de acesso (gerentes como assinantes, só a aba): 18441325686, aba Painel 293737785
- Item usado como alvo das notificações: 13626485007
- Quadro de dados (só CoPlan): 18441323203 "Conferência de Datas de Fim"
- Fonte das datas: 02.01 Projetos em Planejamento (18412010674), colunas timerange_mm6vw3pb e date_mm5g69fd

## Regras

- CoPlan = donos do quadro de dados. Vê todos os projetos, pede conferência (status Revisar datas + prazo + notificação da monday) e aplica as correções no 02.01.
- Gerente = pessoa na coluna Gerente ou e-mail na coluna "E-mail do gerente". Responde "datas conferidas" ou "datas corrigidas".
- Leituras e gravações no quadro de dados usam o token OAuth do app (o gerente não acessa esse quadro). A gravação no 02.01 sai pelo navegador de quem aplica (relay).
- Job `lembrete` (server/jobs.ts) avisa os gerentes com projetos em Revisar datas. Agendamento ainda não criado.

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
