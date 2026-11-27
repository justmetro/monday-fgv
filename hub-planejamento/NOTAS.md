# Hub de Planejamento (app 12877701)

Hub de IA do planejamento de projetos. Parte do item do projeto no 02.01 Projetos em Planejamento, vincula o quadro [PLAN] criado pelo botão "Criar quadro de planejamento" e pré-preenche, com prévia editável por etapa: TAP (doc "0. TAP" do quadro), Produtos, EAP e Cronograma (Níveis 2, 3 e 4), Riscos específicos, Calculadora de Riscos v3 e complemento dos riscos, Indicadores (OKRs) e Partes Interessadas.

- App 12877701, versão live v3 20832427, feature 130721424 (Board View). Versões anteriores: v1 20831196 e v2 (feature 130718610).
- Aba no quadro 09.0 Hub de Planejamento (18441661190), view 294170734, pasta 09. Ferramentas de Planejamento.
- Servidor: https://live1-service-29669755-a2a4a63b.us.monday.app (versão v3: https://ce14b-service-29669755-a2a4a63b.us.monday.app). OAuth em /oauth/start, retorno em /oauth/callback (cadastrado no manifest como redirectUri).
- Escopos: boards:read/write, boards:update, me:read, users:read, workspaces:read/write, docs:read/write, ai:consume, assets:read. Mudança de escopo ou de URL de OAuth exige versão nova (`mapps manifest:import -a 12877701`).
- Variáveis do monday code: CLIENT_SECRET, CRON_KEY, GEMINI_API_KEY (chave do Google AI Studio). Sem MONDAY_API_TOKEN.
- Banco (Document DB): hub_runs (execuções e resultados por etapa), hub_docs (texto dos documentos), app_oauth, app_mutacoes, app_jobs.

## Como funciona

- Autorização por pessoa: na primeira vez, o hub mostra "Autorize o hub a agir no seu nome". O botão pede ao servidor um link de uso único (`pedirAutorizacao`, válido 15 min), abre `/oauth/start?s=...` numa aba e a pessoa clica em Authorize. O retorno (`/oauth/callback`, sempre a URL live) confere que a conta que autorizou é a mesma da sessão e guarda o token em `app_oauth` com `_id: u:<userId>`. Sem autorização, o hub não gera nem grava.
- Tudo o que roda no servidor usa o token de quem está no dash: IA da monday (platform-ai-gateway), escrita do TAP (MCP hospedado da monday, porque a API GraphQL pública não alcança docs de aba), anexos na coluna Documentos de Pactuação (file_mm9f3wqj) do 02.01 e as gravações nos quadros. O token geral do app (`_id: token`, autorizado por admin em `/oauth/start` sem parâmetro) ficou só como reserva para leituras sem sessão.
- Gravação no quadro: `gravacao:gravarNoQuadro` (produtos, eap, riscos, partes, indicadores, complemento, calculadora) roda em segundo plano no servidor com o token da pessoa (`tokenAtual`, AsyncLocalStorage). A tela só dispara e acompanha `etapas.<x>.gravando / progressoGravacao / erroGravacao`; pode fechar a aba. Sem sinal de vida por 3 min, `estadoEtapas` marca a gravação como interrompida. Ao terminar, o servidor atualiza o registro no 09.0.
- As bibliotecas `src/generated/lib` (gravar, quadros, calculadora v3) são as mesmas no navegador e no servidor: `lib/monday.js` recebe o executor por `definirExecutor` (SDK no navegador em `src/main.tsx`, fetch com token em `server/index.ts`). No servidor os lotes são de 20 itens e as alterações rodam 3 lotes em paralelo.
- Calculadora no servidor: arquiva os exemplos, cadastra no 09.1, roda o motor, envia ao [PLAN] (rótulo de dropdown que falta no destino é criado) e dispara a geração do complemento. No SUFOTUR levou 51 s; aplicar o complemento em 73 riscos levou 17 s.
- IA: gateway da monday, modelo padrão `monday-standard`. Também aceitos pelo gateway e listados no app: gpt-5 e gpt-5-mini. Cada etapa lê todos os documentos (cerca de 110 mil tokens no caso SUFOTUR) e custa entre US$ 0,30 e 0,45.
- Gemini como alternativa (gemini-3.5-flash e gemini-3.8-flash), pela API do Google no formato OpenAI (`generativelanguage.googleapis.com/v1beta/openai`), com a chave GEMINI_API_KEY. Não consome crédito da monday. No nível gratuito há limite por minuto e por dia, e o Google pode usar o conteúdo para melhorar os produtos; com faturamento ativo na chave isso não acontece. Os modelos Pro não entram no nível gratuito.
- Etapas de IA rodam em segundo plano no servidor (`gerarEtapa` / `iniciarGeracao`) e a tela consulta `estadoEtapas` a cada 4 s enquanto algo gera ou grava.
- Prompts em `src/generated/server/prompts.ts`, base de conhecimento da metodologia em `conhecimento.ts` (Guia de Bolso, Eixos, Tipologias, Tipos de Riscos, Partes Interessadas e responsabilidades dos três modelos de TAP: padrão, CNCA e GA).
- Colunas do quadro [PLAN] v6 em `src/generated/lib/quadros.ts` (CP). São iguais em todos os quadros criados pelo modelo (quadro modelo 18430945750, área "Projeto - Planejamento v2").
- Cronograma: `X.Y. ENTREGÁVEL | ...` (EAP Nível 2), `X.Y.Z. MARCO | ...` (Nível 3) e `X.Y.Z.W. Verbo ...` (Nível 4, rótulo criado na primeira gravação), ligados ao produto pela coluna Produto - Cronograma. A aba 8. CRONOGRAMA passa a filtrar Níveis 3 e 4.
- TAP: necessidades além das 5 do modelo viram itens numerados novos na mesma célula (`create_block` com `parent_block_id`, em ordem inversa logo após o último item).

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
- O modelo 18430945750 não deixou alterar colunas pela API (Forbidden). Os rótulos "Nível 4" (EAP) e "Público final" (Impactado) são criados em cada quadro na gravação.
- Gravar EAP e riscos específicos de novo cria os itens outra vez; produtos e complemento atualizam.
