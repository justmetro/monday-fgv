import { groupIdOf, type GroupKey, type ProjectConfig } from './fields';

/** skip = lê as atividades sem subelementos; only = lê apenas os subelementos (atividades não são regravadas). */
export type SubMode = 'skip' | 'only';
export type Stage = { label: string; groups: GroupKey[]; subMode?: SubMode };

/**
 * Etapas de leitura/gravação: uma requisição curta por grupo, para não exceder o tempo limite do servidor.
 * `only` restringe aos grupos pedidos (ex.: atualização de um único grupo).
 */
export function stagesOf(cfg: ProjectConfig | null, only?: GroupKey[]): Stage[] {
  const want = (g: GroupKey) => !!groupIdOf(cfg, g) && (!only || only.includes(g));
  const out: Stage[] = [];
  const im = (['ind', 'med'] as GroupKey[]).filter(want);
  if (im.length) out.push({ label: 'Indicadores e medições', groups: im });
  if (want('sched')) {
    out.push({ label: 'Cronograma', groups: ['sched'], subMode: 'skip' });
    if (cfg?.importSubitems) out.push({ label: 'Subelementos do Cronograma', groups: ['sched'], subMode: 'only' });
  }
  if (want('prod')) out.push({ label: 'Produtos', groups: ['prod'] });
  if (want('risk')) out.push({ label: 'Riscos', groups: ['risk'] });
  return out;
}
