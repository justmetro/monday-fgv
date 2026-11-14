import { downloadCSV, textVal } from '@generated/lib/engine';
import { MATCH_FIELDS } from '@generated/lib/fields';

const col = (field) => ({ label: field.label, value: (r) => textVal(field, r) });

export function exportView({ mod, state, filtered, columns, vagaMode, kanbanMatch, visibleMatches }) {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `${mod.id}-${stamp}.csv`;
  try {
    if (mod.id === 'vagas' && (vagaMode || (state.view === 'kanban' && kanbanMatch))) {
      const vf = ['name', 'projeto', 'statusDaVaga', 'cargoPapel'].map((k) => mod.fmap[k]);
      const mf = MATCH_FIELDS.filter((f) => f.key !== '_vagaName');
      const rows = filtered.flatMap((v) => {
        const ms = v._visibleMatches ?? [];
        return ms.length ? ms.map((m) => ({ v, m })) : [{ v, m: null }];
      });
      const cols = [
        ...vf.map((f) => ({ label: f.label, value: (r) => textVal(f, r.v) })),
        ...mf.map((f) => ({ label: f.label, value: (r) => (r.m ? textVal(f, r.m) : '') })),
      ];
      downloadCSV(name, cols, state.view === 'kanban' ? rows.filter((r) => r.m && visibleMatches.includes(r.m)) : rows);
      return;
    }
    const fields = state.view === 'table' ? columns : mod.fields.filter((f) => f.key !== 'temDias');
    downloadCSV(name, fields.map(col), filtered);
  } catch (e) {
    console.error('Falha ao exportar CSV', e);
  }
}
