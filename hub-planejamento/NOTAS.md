# Hub de Planejamento (app 12877701)

Hub de IA do planejamento de projetos. Parte do item do projeto no 02.01 Projetos em Planejamento, vincula o quadro [PLAN] criado pelo botão "Criar quadro de planejamento" e pré-preenche, com prévia editável por etapa: TAP (doc "0. TAP" do quadro), Produtos, EAP e Cronograma (Níveis 2, 3 e 4), Riscos específicos, Calculadora de Riscos v3 e complemento dos riscos, Indicadores (OKRs) e Partes Interessadas.

- App 12877701, versão live v3 20832427, feature 130721424 (Board View). Versões anteriores: v1 20831196 e v2 (feature 130718610).
- Aba no quadro 09.0 Hub de Planejamento (18441661190), view 294170734, pasta 09. Ferramentas de Planejamento.
- Servidor: https://live1-service-29669755-a2a4a63b.us.monday.app (versão v3: https://ce14b-service-29669755-a2a4a63b.us.monday.app). OAuth em /oauth/start, retorno em /oauth/callback (cadastrado no manifest como redirectUri).
- Escopos: boards:read/write, boards:update, me:read, users:read, workspaces:read/write, docs:read/write, ai:consume, assets:read. Mudança de escopo ou de URL de OAuth exige versão nova (`mapps manifest:import -a 12877701`).
- Variáveis do monday code: CLIENT_SECRET, CRON_KEY. Sem MONDAY_API_TOKEN.
- Banco (Document DB): hub_runs (execuções e resultados por etapa), hub_docs (texto dos documentos), app_oauth, app_mutacoes, app_jobs.

## Como funciona

- Leitura e gravação nos quadros: pelo navegador de quem usa (monday SDK), no nome dessa pessoa. Exceções que rodam no servidor com o token OAuth do app: chamadas à IA da monday (platform-ai-gateway), escrita do TAP (doc de aba do quadro, via MCP hospedado da monday, porque a API GraphQL pública não alcança docs de aba) e anexo dos arquivos na coluna Documentos de Pactuação (file_mm9f3wqj) do 02.01.
- IA: gateway da monday, modelo padrão `monday-standard`. Também aceitos pelo gateway e listados no app: gpt-5 e gpt-5-mini. Cada etapa lê todos os documentos (cerca de 110 mil tokens no caso SUFOTUR) e custa entre US$ 0,30 e 0,45.
- Etapas de IA rodam em segundo plano no servidor (`gerarEtapa`) e a tela consulta `estadoEtapas` a cada 4 s.
- Prompts em `src/generated/server/prompts.ts`, base de conhecimento da metodologia em `conhecimento.ts` (Guia de Bolso, Eixos, Tipologias, Tipos de Riscos, Partes Interessadas e responsabilidades dos três modelos de TAP: padrão, CNCA e GA).
- Calculadora de Riscos v3: o hub reaproveita `engineData`, `engineRun`, `engineReconcile`, `sendData` e `sendRun` da pasta calculadora-riscos-v3 (copiados em `src/generated/lib`). Cadastra o projeto no 09.1, roda o motor e envia os riscos ao grupo Riscos do [PLAN].
- Colunas do quadro [PLAN] v6 em `src/generated/lib/quadros.ts` (CP). São iguais em todos os quadros criados pelo modelo.
- Cronograma: `X.Y. ENTREGÁVEL | ...` (EAP Nível 2), `X.Y.Z. MARCO | ...` (Nível 3) e `X.Y.Z.W. Verbo ...` (Nível 4, rótulo criado na primeira gravação), ligados ao produto pela coluna Produto - Cronograma.

## Build e publicação

```bash
npm i --legacy-peer-deps
npm run build
cd deploy && npm i --package-lock-only && cd ..
mapps code:push -a 12877701 -i 20832427 -d deploy -f
```

## Teste com SUFOTUR (26/11/2026)

Quadro [PLAN] 18441667419, execução 36ed1237-8f90-4edb-ae84-2a8377977081, início previsto 01/12/2026 e 180 dias. Gravados: TAP, 10 produtos, 282 itens de cronograma, 19 riscos específicos, 73 riscos da calculadora com complemento, 16 indicadores e 41 medições, 12 partes interessadas. Custo de IA da execução: cerca de US$ 3,80.

Pontos conhecidos:
- O settings_str da coluna EAP demora a mostrar o rótulo Nível 4 criado na hora; `ajustarAbaCronograma` completa os ids pelos itens gravados.
- A gravação pelo navegador é lenta em volume (cerca de 1,3 item por segundo); a aba precisa ficar aberta. Se o monday recarregar a aba no meio, basta clicar de novo: produtos e complemento atualizam, EAP e riscos específicos criam de novo.
- No TAP, as necessidades além da quinta entram como linhas no último item da lista numerada do modelo.
- A calculadora v3 não cria rótulo que falta no destino (aviso "'Público final' não existe em Impactado").
