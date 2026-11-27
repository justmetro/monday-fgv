# Hub de Planejamento (app 12877701)

Hub de IA do planejamento de projetos. Parte do item do projeto no 02.01 Projetos em Planejamento, vincula o quadro [PLAN] criado pelo botão "Criar quadro de planejamento" e pré-preenche, com prévia editável por etapa: TAP (doc "0. TAP" do quadro), Produtos, EAP e Cronograma (Níveis 2, 3 e 4), Riscos específicos, Calculadora de Riscos v3 e complemento dos riscos, Indicadores (OKRs) e Partes Interessadas.

- App 12877701, versão live v3 20832427, feature 130721424 (Board View). Versões anteriores: v1 20831196 e v2 (feature 130718610).
- Aba no quadro 09.0 Hub de Planejamento (18441661190), view 294170734, pasta 09. Ferramentas de Planejamento.
- Servidor: https://live1-service-29669755-a2a4a63b.us.monday.app (versão v3: https://ce14b-service-29669755-a2a4a63b.us.monday.app). OAuth em /oauth/start, retorno em /oauth/callback (cadastrado no manifest como redirectUri).
- Escopos: boards:read/write, boards:update, me:read, users:read, workspaces:read/write, docs:read/write, ai:consume, assets:read. Mudança de escopo ou de URL de OAuth exige versão nova (`mapps manifest:import -a 12877701`).
- Variáveis do monday code: CLIENT_SECRET, CRON_KEY, GEMINI_API_KEY (chave do Google AI Studio); secret OPENROUTER_API_KEY (`mapps code:secret`). Sem MONDAY_API_TOKEN.
- Banco (Document DB): hub_runs (execuções e resultados por etapa), hub_docs (texto dos documentos), app_oauth, app_mutacoes, app_jobs.

## Como funciona

- Autorização por pessoa: na primeira vez, o hub mostra "Autorize o hub a agir no seu nome". O botão pede ao servidor um link de uso único (`pedirAutorizacao`, válido 15 min), abre `/oauth/start?s=...` numa aba e a pessoa clica em Authorize. O retorno (`/oauth/callback`, sempre a URL live) confere que a conta que autorizou é a mesma da sessão e guarda o token em `app_oauth` com `_id: u:<userId>`. Sem autorização, o hub não gera nem grava.
- Tudo o que roda no servidor usa o token de quem está no dash: IA da monday (platform-ai-gateway), escrita do TAP (MCP hospedado da monday, porque a API GraphQL pública não alcança docs de aba), anexos na coluna Documentos de Pactuação (file_mm9f3wqj) do 02.01 e as gravações nos quadros. O token geral do app (`_id: token`, autorizado por admin em `/oauth/start` sem parâmetro) ficou só como reserva para leituras sem sessão.
- Gravação no quadro: `gravacao:gravarNoQuadro` (produtos, eap, riscos, partes, indicadores, complemento, calculadora) roda em segundo plano no servidor com o token da pessoa (`tokenAtual`, AsyncLocalStorage). A tela só dispara e acompanha `etapas.<x>.gravando / progressoGravacao / erroGravacao`; pode fechar a aba. Sem sinal de vida por 3 min, `estadoEtapas` marca a gravação como interrompida. Ao terminar, o servidor atualiza o registro no 09.0.
- As bibliotecas `src/generated/lib` (gravar, quadros, calculadora v3) são as mesmas no navegador e no servidor: `lib/monday.js` recebe o executor por `definirExecutor` (SDK no navegador em `src/main.tsx`, fetch com token em `server/index.ts`). No servidor os lotes são de 20 itens e as alterações rodam 3 lotes em paralelo.
- Calculadora no servidor: arquiva os exemplos, cadastra no 09.1, roda o motor, envia ao [PLAN] (rótulo de dropdown que falta no destino é criado) e dispara a geração do complemento. No SUFOTUR levou 51 s; aplicar o complemento em 73 riscos levou 17 s.
- IA: gateway da monday, modelo padrão `monday-standard`. Também aceitos pelo gateway e listados no app: gpt-5 e gpt-5-mini. Cada etapa lê todos os documentos (cerca de 110 mil tokens no caso SUFOTUR) e custa entre US$ 0,30 e 0,45.
- Gemini como alternativa (gemini-3.5-flash e gemini-3.8-flash), pela API do Google no formato OpenAI (`generativelanguage.googleapis.com/v1beta/openai`), com a chave GEMINI_API_KEY. Não consome crédito da monday. No nível gratuito há limite por minuto e por dia, e o Google pode usar o conteúdo para melhorar os produtos; com faturamento ativo na chave isso não acontece. Os modelos Pro não entram no nível gratuito.
- OpenRouter gratuito como segunda alternativa: `openrouter/free` (com reservas `nvidia/nemotron-3-ultra-550b-a55b:free` e `nvidia/nemotron-3.5-super-vl:free` no campo `models`) e, direto, Nemotron 3 Ultra, Nemotron 3.5 Super, Nemotron 3.5 Lightning, ERNIE 5.5 Flash, Particle 1 e Gemma 4 31B (todos com 262 mil tokens de contexto ou mais; um modelo escolhido direto cai para `openrouter/free` se estiver fora do ar). Ficaram de fora os gratuitos pequenos ou com pouco contexto (Liquid LFM 1.7B, Nemotron Nano, Gemma 4 26B, Flint). Limite da conta: 20 pedidos por minuto e 50 por dia (1000 por dia depois de uma compra única de US$ 10); o consumo do dia aparece em `GET https://openrouter.ai/api/v1/key`. O 429 vira mensagem amigável. Provedores dos modelos gratuitos podem guardar os prompts. Em teste com cerca de 100 mil tokens de entrada, o roteador respondeu em 3 s.
- Etapas de IA rodam em segundo plano no servidor (`gerarEtapa` / `iniciarGeracao`) e a tela consulta `estadoEtapas` a cada 4 s enquanto algo gera ou grava.
- Prompts em `src/generated/server/prompts.ts`, base de conhecimento da metodologia em `conhecimento.ts` (Guia de Bolso, Eixos, Tipologias, Tipos de Riscos, Partes Interessadas e responsabilidades dos três modelos de TAP: padrão, CNCA e GA).
- Colunas do quadro [PLAN] v6 em `src/generated/lib/quadros.ts` (CP). São iguais em todos os quadros criados pelo modelo (quadro modelo 18430945750, área "Projeto - Planejamento v2").
- Cronograma: `X.Y. nome` (EAP Nível 2) e `X.Y.Z. nome` (Nível 3), sem as palavras ENTREGÁVEL e MARCO, ligados ao produto pela coluna Produto - Cronograma. Cada atividade `X.Y.Z.W. Verbo ...` (Nível 4) é subitem do seu marco (colunas do subitem: Status color_mm48hram, Cronograma planejado timerange_mm489r9r, Frentes color_mm48sa6t). A aba 8. CRONOGRAMA filtra os marcos (Nível 3), que mostram as atividades como subitens.
- Responsável: todo item que o hub cria no [PLAN] (produtos, cronograma e subitens, riscos, riscos da calculadora, indicadores, medições e partes) recebe a equipe Planejamento (team 1359388) na coluna Responsável (person).
- TAP: tipos de entrega pelos códigos do Manual de Tipologias de Serviço (`TIPOLOGIAS_MANUAL` em conhecimento.ts, gravados como "Categoria: Modalidade (código)"); "Resultados esperados" sem prazo de execução, fases, lote, item ou "1 X"; justificativa sem lei de criação do cliente nem artigos de lei; equipe gestora só com "a definir" (sem perfis sugeridos).
- Partes interessadas: a FGV DGPE nunca entra (prompt e filtro na gravação).
- Indicadores: padrão de redação, unidades (Percentual, Média, Pontuação ou escala, Binário, Unidade, criadas no quadro na gravação) e metas padrão da revisão de indicadores (nov/2026) em `INDICADORES_PADRAO`; cardápio de 211 indicadores por tipologia em `server/cardapio.ts` (aba Cardápio da Planilha de Revisão dos Indicadores, sem o eixo GA).
- TAP: necessidades além das 5 do modelo viram itens numerados novos na mesma célula (`create_block` com `parent_block_id`, em ordem inversa logo após o último item).

## Planilha, comparação com o quadro e apagar (nov/2026)

- Documentos: "Adicionar documentos" soma à lista da execução (mesmo nome substitui); `hub:ajustarDocumentos` remove um ou vários e troca o tipo. Os anexos do 02.01 não são removidos.
- Planilha (`server/planilha.ts`, SheetJS 0.20.3 do cdn.sheetjs.com): `exportarPlanilha` monta o .xlsx (Leia-me, Análise e TAP, Pendências, Produtos, Cronograma, Riscos, Riscos da calculadora, Indicadores, Partes interessadas e a aba oculta `_dados` com o JSON completo) e guarda em `hub_arquivos`; o download sai por `GET /arquivo/<id>` (vale 15 min). `importarPlanilha` lê as abas de volta para as prévias (recusa planilha de outro item do 02.01). No Cronograma e nos Indicadores a ordem das linhas define a hierarquia.
- Comparação (`server/comparar.ts`): `compararComQuadro` casa prévia e quadro pela chave (código do produto; nível + produto + título; título do risco; tipo + nome do indicador; nome da parte) e depois por semelhança de palavras no mesmo escopo. Devolve novos, alterados (com os campos diferentes), só no quadro e iguais. `aplicarComparacao` (segundo plano) adiciona, atualiza (sem mexer em status e responsável, mantendo a numeração do nome) e arquiva. Na EAP, atividades novas entram como subitens do marco casado; atividades no formato antigo (itens soltos de Nível 4) aparecem como "só no quadro".
- Gravar de novo EAP, riscos, partes ou indicadores com itens no grupo agora é recusado com aviso para usar a comparação (produtos continuam atualizando pelo código).
- Ids gravados ficam em `etapas.<x>.itensQuadro`. `previaApagar` lista o que sai (ids do hub, itens que batem com a prévia, atividades do formato antigo; medições junto dos indicadores; na calculadora, os riscos `Rn-nnn |`). `apagarDoQuadro` arquiva ou exclui de vez (exige a confirmação EXCLUIR).

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
