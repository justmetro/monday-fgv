# Apps próprios da monday (FGV DGPE)

Cada pasta é um app do Developer Center (conta fgvdgpe-projetos, account 29669755), com front em React + monday SDK e servidor no monday code, publicado pela CLI mapps. Tokens e Client Secret nunca entram no repositório: ficam nas variáveis do monday code.

| Pasta | App | Versão | Feature | Quadro / aba |
|---|---|---|---|---|
| dashboard-engajamento | 12685411 | 20036795 | 128993330 | 18439727709 / view 291850616 |

## Publicar uma pasta

```bash
npm i -g @mondaycom/apps-cli && mapps init -t <token do Developer Center>
cd <pasta>
npm i --legacy-peer-deps
npm run build
cd deploy && npm i --package-lock-only && cd ..
mapps code:push -a <app> -i <versão> -d deploy -f
```
