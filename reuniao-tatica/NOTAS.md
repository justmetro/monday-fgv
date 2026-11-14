# Reunião Tática de Monitoramento (app 12694561)

Gera o PPT da Reunião Tática, da Reunião SAE e da Reunião CDPE (abas), com dados do Levantamento de Produtos (18398687489) e do Quadro de Encaminhamentos.
Versão live v1 (20073495), feature 129075138, aba "Gerar PPT" no quadro 18439872031 (workspace 16137010).
Servidor: https://d002c-service-29669755-d04e957b.us.monday.app (serve o front e public/modelo-base.pptx).

Build: `npm i --legacy-peer-deps && npm run build`; publicar com `mapps code:push -a 12694561 -i <versão> -d deploy -f`.
Teste local do motor: `npx tsx teste.ts '<parâmetros JSON>' saida.pptx` (precisa de token de leitura).
