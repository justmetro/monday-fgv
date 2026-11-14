# Monitor de Indicadores (app 12684174)

Origem: Vibe 10552450 (só front). Versão live v2 (20032897), feature 128984808, aba no quadro 01.02 Indicadores (18400760018), view 291820365.
Hospedagem: monday code CDN (`mapps code:push -c -a 12684174 -i <versão> -d ./dist` e `app-features:build -t monday_code_cdn`).
Escopos: boards:read, boards:write, me:read, users:read.

Build: `npm i && npm i pdfmake && npx vite build`. A camada de dados fica em src/api/BoardSDK.js (quadros 01.02 e 02.01).
