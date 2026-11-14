import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@vibe/db/server';
import { getCurrentUser } from '@api/current-user.server';
import { executeAiRequest } from '@api/ai-service';
import { indicatorClasses, indicators, taxonomyMeta } from '@generated/models';
import type { IndicatorClassDoc, IndicatorDoc } from '@generated/models';
import { classText, ikey, signatureOf } from '@generated/lib/intel-sig';
import { loadAll } from './sync.server';

async function requireUser() {
  let u = await getCurrentUser().catch(() => null);
  if (!u) { await new Promise((r) => setTimeout(r, 400)); u = await getCurrentUser().catch(() => null); }
  // Identidade indisponível momentaneamente: segue com identificação neutra (usada só para registro).
  return u ?? { id: 'app', name: 'Aplicativo', kind: 'guest' as const };
}
const nrm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

async function loadClasses() {
  const out = await db.collection(indicatorClasses).limit(1000).getPage();
  const docs = [...out.docs];
  let cur = out.cursor;
  while (cur) { const p = await db.collection(indicatorClasses).limit(1000).startAfter(cur).getPage(); docs.push(...p.docs); cur = p.cursor; }
  return docs;
}
async function version(bump = false) {
  const m = (await db.collection(taxonomyMeta).limit(1).get())[0];
  const now = new Date().toISOString();
  if (!m) { const v = 1; await db.collection(taxonomyMeta).add({ versao: v, updatedAt: now }); return v; }
  if (!bump) return m.data.versao;
  const v = m.data.versao + 1;
  await db.collection(taxonomyMeta).doc(m.id).update({ versao: v, updatedAt: now });
  return v;
}

export const getClassState = createServerFn({ method: 'GET' })
  .validator(z.object({}).optional())
  .handler(async () => {
    const [docs, v] = await Promise.all([loadClasses(), version()]);
    return { classes: docs.map((d) => d.data), versao: v };
  });

const aiItem = z.object({
  key: z.string(), tema: z.string().min(1), subtema: z.string().min(1), familia: z.string().min(1),
  publico: z.string(), justificativa: z.string(), confianca: z.enum(['alta', 'media', 'baixa']), precisaRevisao: z.boolean(),
});
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['itens'],
  properties: {
    itens: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['key', 'tema', 'subtema', 'familia', 'publico', 'justificativa', 'confianca', 'precisaRevisao'],
        properties: {
          key: { type: 'string', description: 'Chave exatamente como recebida (projectBoardId:itemId)' },
          tema: { type: 'string', description: 'Assunto amplo' },
          subtema: { type: 'string', description: 'Dimensão específica dentro do tema' },
          familia: { type: 'string', description: 'O que efetivamente está sendo medido' },
          publico: { type: 'string', description: 'Público-alvo, ou string vazia se não identificável' },
          justificativa: { type: 'string', description: 'Uma frase curta' },
          confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          precisaRevisao: { type: 'boolean' },
        },
      },
    },
  },
};
const SYSTEM = `Você classifica indicadores de projetos educacionais e de gestão pública em uma taxonomia de três níveis: tema (assunto amplo), subtema (dimensão específica) e família (o que efetivamente é medido). Exemplo: Tema "Formação", subtema "Participação de cursistas", famílias distintas "Adesão", "Frequência", "Permanência", "Conclusão". Aprendizagem e satisfação são famílias distintas mesmo na mesma formação. Construa as categorias a partir dos textos; não force categorias inadequadas. REUTILIZE exatamente os nomes da taxonomia existente quando forem equivalentes, para evitar sinônimos. Use nomes curtos em português, com inicial maiúscula. Não use desempenho nem eixo do projeto para classificar. Marque precisaRevisao=true quando o texto for insuficiente ou ambíguo. Responda apenas com as chaves recebidas.`;

/** Classifica um lote (até 20). Reutiliza classificações cujos textos não mudaram; revisadas nunca são sobrescritas. */
export const classifyBatch = createServerFn({ method: 'POST' })
  .validator(z.object({ keys: z.array(z.string()).min(1).max(20), force: z.boolean().optional() }))
  .handler(async ({ data }) => {
    await requireUser();
    const allInd = (await loadAll<IndicatorDoc>(indicators)).map((d) => d.data).filter((i) => i.active);
    const indBy = new Map(allInd.map((i) => [ikey(i.projectBoardId, i.itemId), i]));
    const classes = await loadClasses();
    const clsBy = new Map(classes.map((c) => [c.data.key, c]));
    const todo: IndicatorDoc[] = [];
    let reused = 0, flagged = 0;
    for (const k of data.keys) {
      const ind = indBy.get(k);
      if (!ind) continue; // ID inexistente: ignorado
      const ex = clsBy.get(k);
      const sig = signatureOf(ind);
      if (ex && ex.data.assinatura === sig && !data.force) { reused++; continue; }
      if (ex && ex.data.revisado) {
        if (ex.data.assinatura !== sig && !ex.data.textoAlterado) { await db.collection(indicatorClasses).doc(ex.id).update({ textoAlterado: true }); flagged++; }
        else reused++;
        continue;
      }
      todo.push(ind);
    }
    if (!todo.length) return { classified: 0, reused, flagged, rejected: 0 };
    // Taxonomia existente para reconciliação entre lotes.
    const tax = [...new Set(classes.map((c) => `${c.data.tema} > ${c.data.subtema} > ${c.data.familia}`))].slice(0, 400);
    const payload = todo.map((i) => ({ key: ikey(i.projectBoardId, i.itemId), ...classText(i) }));
    const prompt = `Taxonomia existente (reutilize nomes equivalentes):\n${tax.join('\n') || '(vazia)'}\n\nIndicadores a classificar (JSON):\n${JSON.stringify(payload)}`;
    const res = await executeAiRequest(prompt, { schema: SCHEMA, systemPrompt: SYSTEM });
    const parsed = z.object({ itens: z.array(aiItem) }).safeParse(res.data);
    if (!parsed.success) throw new Error('A resposta da IA não pôde ser validada. Tente novamente.');
    // Canoniza nomes contra a taxonomia existente (mesma grafia normalizada).
    const canon = new Map<string, string>();
    classes.forEach((c) => [c.data.tema, c.data.subtema, c.data.familia].forEach((n) => canon.set(nrm(n), n)));
    const fix = (s: string) => { const t = s.trim(); const c = canon.get(nrm(t)); if (c) return c; canon.set(nrm(t), t); return t; };
    const allowed = new Set(payload.map((p) => p.key));
    const v = await version(true);
    const now = new Date().toISOString();
    let classified = 0, rejected = 0;
    const seen = new Set<string>();
    for (const it of parsed.data.itens) {
      if (!allowed.has(it.key) || seen.has(it.key)) { rejected++; continue; }
      seen.add(it.key);
      const ind = indBy.get(it.key)!;
      const doc: IndicatorClassDoc = {
        key: it.key, projectBoardId: ind.projectBoardId, itemId: ind.itemId,
        tema: fix(it.tema), subtema: fix(it.subtema), familia: fix(it.familia),
        publico: it.publico.trim() || null, justificativa: it.justificativa.slice(0, 300),
        confianca: it.confianca, precisaRevisao: it.precisaRevisao || it.confianca === 'baixa',
        origem: 'ia', revisado: false, revisadoEm: null, assinatura: signatureOf(ind), textoAlterado: false,
        taxonomiaVersao: v, classificadoEm: now,
      };
      const ex = clsBy.get(it.key);
      if (ex) await db.collection(indicatorClasses).doc(ex.id).set(doc);
      else await db.collection(indicatorClasses).add(doc);
      classified++;
    }
    return { classified, reused, flagged, rejected: rejected + (todo.length - seen.size) };
  });

const clsInput = z.object({
  key: z.string(), tema: z.string().trim().min(1).max(120), subtema: z.string().trim().min(1).max(120),
  familia: z.string().trim().min(1).max(120), publico: z.string().max(120).nullable(), revisado: z.boolean(),
});
/** Correção/confirmação manual de uma classificação. */
export const saveClass = createServerFn({ method: 'POST' })
  .validator(clsInput)
  .handler(async ({ data }) => {
    await requireUser();
    const allInd = (await loadAll<IndicatorDoc>(indicators)).map((d) => d.data);
    const ind = allInd.find((i) => ikey(i.projectBoardId, i.itemId) === data.key);
    if (!ind) throw new Error('Indicador não encontrado.');
    const ex = (await db.collection(indicatorClasses).where('key', '==', data.key).limit(1).get())[0];
    const same = ex && ex.data.tema === data.tema && ex.data.subtema === data.subtema && ex.data.familia === data.familia;
    const v = await version(true);
    const now = new Date().toISOString();
    const doc: IndicatorClassDoc = {
      key: data.key, projectBoardId: ind.projectBoardId, itemId: ind.itemId,
      tema: data.tema, subtema: data.subtema, familia: data.familia, publico: data.publico?.trim() || null,
      justificativa: same ? ex.data.justificativa : 'Classificação definida manualmente.',
      confianca: same ? ex.data.confianca : 'alta', precisaRevisao: false,
      origem: same && ex.data.origem !== 'manual' ? 'ia_revisada' : 'manual',
      revisado: data.revisado, revisadoEm: data.revisado ? now : null,
      assinatura: signatureOf(ind), textoAlterado: false, taxonomiaVersao: v, classificadoEm: ex?.data.classificadoEm ?? now,
    };
    if (ex) await db.collection(indicatorClasses).doc(ex.id).set(doc); else await db.collection(indicatorClasses).add(doc);
    return doc;
  });

export const markReviewed = createServerFn({ method: 'POST' })
  .validator(z.object({ keys: z.array(z.string()).min(1).max(500) }))
  .handler(async ({ data }) => {
    await requireUser();
    const docs = (await loadClasses()).filter((d) => data.keys.includes(d.data.key));
    const now = new Date().toISOString();
    for (const d of docs) {
      await db.collection(indicatorClasses).doc(d.id).update({
        revisado: true, revisadoEm: now, precisaRevisao: false, textoAlterado: false,
        origem: d.data.origem === 'ia' ? 'ia_revisada' : d.data.origem,
      });
    }
    await version(true);
    return { ok: true, n: docs.length };
  });

/** Renomeia uma categoria; usar um nome já existente une as categorias. */
export const renameCategory = createServerFn({ method: 'POST' })
  .validator(z.object({ level: z.enum(['tema', 'subtema', 'familia']), from: z.string().min(1), to: z.string().trim().min(1).max(120) }))
  .handler(async ({ data }) => {
    await requireUser();
    const docs = (await loadClasses()).filter((d) => d.data[data.level] === data.from);
    const v = await version(true);
    for (const d of docs) await db.collection(indicatorClasses).doc(d.id).update({ [data.level]: data.to, taxonomiaVersao: v } as Partial<IndicatorClassDoc>);
    return { ok: true, n: docs.length };
  });

/** A IA apenas interpreta achados já calculados por código; não recebe dados pessoais. */
export const interpretReport = createServerFn({ method: 'POST' })
  .validator(z.object({ facts: z.string().max(60000) }))
  .handler(async ({ data }) => {
    await requireUser();
    const res = await executeAiRequest(`Achados calculados (JSON):\n${data.facts}`, {
      systemPrompt: 'Você redige o resumo executivo de um relatório de indicadores, em português formal e objetivo. Use SOMENTE os números fornecidos; não invente estatísticas nem causas. Não atribua causalidade ao eixo; diferenças podem refletir composição da carteira, metas, periodicidade, projetos compartilhados e qualidade da informação. Até 6 parágrafos curtos.',
      schema: {
        type: 'object', additionalProperties: false, required: ['paragrafos'],
        properties: { paragrafos: { type: 'array', items: { type: 'string' }, maxItems: 6 } },
      },
    });
    const p = z.object({ paragrafos: z.array(z.string()) }).safeParse(res.data);
    if (!p.success) throw new Error('A resposta da IA não pôde ser validada.');
    return p.data.paragrafos;
  });
