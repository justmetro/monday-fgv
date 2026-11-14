import { gql, sleep, errorMessage, isRateLimit, fetchAllItems, txt, dropdownLabels } from '@generated/lib/monday';
import { B_RISCOS } from '@generated/lib/engineData';

export const AUTO_DISCARD_PREFIX = 'Descartado automaticamente pela calculadora';
const RISK_COLS = ['chave', 'id_risco', 'aplic', 'justif', 'sinal', 'grs_origem'];

function toRisk(it) {
  return {
    itemId: it.id,
    key: txt(it.cols.chave).trim(),
    idRisco: txt(it.cols.id_risco).trim(),
    aplic: txt(it.cols.aplic).trim(),
    justif: txt(it.cols.justif),
    sinal: txt(it.cols.sinal),
    origins: dropdownLabels(it.cols.grs_origem),
  };
}

/** Lê do 09.4 (paginação completa) todos os itens cuja chave começa com "projetoId|". */
export async function fetchProjectRisks(projectId) {
  const prefix = `${projectId}|`;
  let items;
  try {
    items = await fetchAllItems(B_RISCOS, RISK_COLS, {
      rules: [{ column_id: 'chave', compare_value: [prefix], operator: 'contains_text' }],
    });
  } catch (err) {
    if (isRateLimit(err)) throw err;
    // Se o filtro no servidor não for aceito, lê o board inteiro e filtra pela chave.
    console.error('Filtro por chave não aceito; lendo o 09.4 completo:', err);
    items = await fetchAllItems(B_RISCOS, RISK_COLS);
  }
  return items.map(toRisk).filter((r) => r.key.startsWith(prefix));
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Compara os riscos já existentes do projeto com a seleção atual e monta as alterações.
 * selectedOrigins: Map chave → grupos de origem atuais.
 */
export function planReconcile(existing, selectedOrigins, hoje) {
  const updates = [];
  const counts = { descartados: 0, sinalizados: 0, reativados: 0 };
  const finalAplic = new Map();
  const reviewLine = `Em ${hoje} este risco deixou de corresponder às respostas do projeto. Revisar se ainda se aplica.`;

  existing.forEach((r) => {
    const values = {};
    let aplic = r.aplic;
    const origins = selectedOrigins.get(r.key);
    if (!origins) {
      if (r.aplic === 'Identificado') {
        values.aplic = { label: 'Não aplicável' };
        values.justif = { text: `${AUTO_DISCARD_PREFIX} em ${hoje}: a resposta que originava este risco foi removida do cadastro.` };
        aplic = 'Não aplicável';
        counts.descartados += 1;
      } else if (r.aplic === 'Aplicável' || r.aplic === 'Em avaliação') {
        const lines = r.sinal.split('\n').map((l) => l.trim());
        if (!lines.includes(reviewLine)) {
          values.sinal = { text: r.sinal.trim() ? `${r.sinal.replace(/\s+$/, '')}\n${reviewLine}` : reviewLine };
          counts.sinalizados += 1;
        }
      }
    } else {
      if (r.aplic === 'Não aplicável' && r.justif.trim().startsWith(AUTO_DISCARD_PREFIX)) {
        values.aplic = { label: 'Identificado' };
        values.justif = { text: '' };
        aplic = 'Identificado';
        counts.reativados += 1;
      }
      if (!sameSet(r.origins, origins)) values.grs_origem = { labels: origins };
    }
    finalAplic.set(r.itemId, aplic);
    if (Object.keys(values).length) updates.push({ itemId: r.itemId, key: r.key, values });
  });

  const ativos = [...finalAplic.values()].filter((a) => a !== 'Não aplicável').length;
  return { updates, counts, ativos };
}

async function updateMany(batch) {
  const defs = [];
  const body = [];
  const vars = {};
  batch.forEach((u, i) => {
    defs.push(`$i${i}: ID!, $v${i}: JSON!`);
    body.push(`u${i}: change_multiple_column_values(board_id: ${B_RISCOS}, item_id: $i${i}, column_values: $v${i}, create_labels_if_missing: false) { id }`);
    vars[`i${i}`] = String(u.itemId);
    vars[`v${i}`] = JSON.stringify(u.values);
  });
  await gql(`mutation (${defs.join(', ')}) { ${body.join(' ')} }`, vars);
}

/** Aplica as alterações no 09.4 em lotes de até 10 (aliases numa única mutation). */
export async function applyUpdates(updates, onFraction) {
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);
    try {
      await updateMany(batch);
    } catch (err) {
      if (isRateLimit(err)) throw err;
      console.error('Lote de atualização falhou, repetindo item a item:', err);
      // Atualizações são idempotentes: repetir item a item isola o que falhou.
      for (const u of batch) {
        try {
          await updateMany([u]);
        } catch (e) {
          throw new Error(`Falha ao atualizar o risco ${u.key}: ${errorMessage(e)}`);
        }
        await sleep(200);
      }
    }
    onFraction?.(Math.min(1, (i + 10) / updates.length));
    await sleep(350);
  }
}
