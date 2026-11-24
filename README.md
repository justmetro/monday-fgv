# Apps próprios da monday (FGV DGPE)

Cada pasta é um app do Developer Center (conta fgvdgpe-projetos, account 29669755), com front em React + monday SDK e servidor no monday code, publicado pela CLI mapps. Tokens e Client Secret nunca entram no repositório: ficam nas variáveis do monday code.

| Pasta | App | Versão | Feature | Quadro / aba |
|---|---|---|---|---|
| dashboard-engajamento | 12685411 | 20379920 | 128993330 | 18439727709 / view 291850616 |
| monitor-indicadores | 12684174 | 20032897 | 128984808 | 18400760018 / view 291820365 |
| portfolio-projetos | 12684861 | 20034487 | 128988338 | 18439723064 / view 291837392 |
| continuidade-projetos | 12688562 | 20379669 | 129022313 | 18437180615 |
| hub-de-vagas | 12694654 | 20073872 | 129075990 | 18427417720 / view 292018430 |
| calculadora-riscos-v3 | 12688939 | 20051458 | 129025711 | 18439788380 / view 291918923 |
| reuniao-tatica | 12694561 | 20073495 | 129075138 | 18439872031 |
| esteira-planejamento | 12703980 | 20376895 | 129159264 | 18412010674 / view 292153406 |
| conferencia-datas | 12846014 | 20698699 | 130425574 | 18441325686 / view 293737785 |

Cada pasta tem um NOTAS.md com servidor, variáveis e o comando de build específico. Os comandos abaixo valem para as pastas com `deploy/`.

## Publicar uma pasta

```bash
npm i -g @mondaycom/apps-cli && mapps init -t <token do Developer Center>
cd <pasta>
npm i --legacy-peer-deps
npm run build
cd deploy && npm i --package-lock-only && cd ..
mapps code:push -a <app> -i <versão> -d deploy -f
```
