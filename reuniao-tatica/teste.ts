// Teste local: node + tsx, lê os quadros com o token e gera o PPT.
import { readFileSync, writeFileSync } from 'node:fs';
import { lerQuadros } from './src/generated/engine/data';
import { gerarPPT } from './src/generated/engine/gerar';
const TOK = readFileSync(process.env.HOME + '/.secrets/monday_dev_token', 'utf8').trim();
const gql = async (query: string, variables: Record<string, unknown>) => {
  const r = await fetch('https://api.monday.com/v2', { method: 'POST', headers: { Authorization: TOK, 'Content-Type': 'application/json', 'API-Version': '2025-04' }, body: JSON.stringify({ query, variables }) });
  const j: any = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors)); return j.data;
};
const P = JSON.parse(process.argv[2]);
const dados = await lerQuadros(gql, (m) => process.stderr.write(m + '\r'));
const r = await gerarPPT(readFileSync('public/modelo-base.pptx'), dados, P);
writeFileSync(process.argv[3], r.bytes);
console.log(r.resumo.join('\n')); console.log('AVISOS:\n' + r.avisos.join('\n'));
