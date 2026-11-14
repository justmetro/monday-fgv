import type { MeasurementDoc, ProjectDoc } from '@generated/models';
import { isDiscarded, type Model } from './metrics';
import { typeKind } from './format';

export const LEVELS = [
  { key: 'referencia', label: 'Referência', rule: '≥ 90%', min: 90, cls: 'bg-[hsl(var(--ok)/0.14)] text-[hsl(var(--ok))]' },
  { key: 'gerenciavel', label: 'Gerenciável', rule: '80% a 89%', min: 80, cls: 'bg-[hsl(var(--chart-1)/0.14)] text-[hsl(var(--chart-1))]' },
  { key: 'atencao', label: 'Atenção', rule: '70% a 79%', min: 70, cls: 'bg-[hsl(var(--warn)/0.16)] text-[hsl(var(--warn))]' },
  { key: 'critico', label: 'Crítico', rule: '60% a 69%', min: 60, cls: 'bg-destructive/12 text-destructive' },
  { key: 'supercritico', label: 'Supercrítico', rule: '< 60%', min: -1, cls: 'bg-destructive text-primary-foreground' },
] as const;
export type Level = (typeof LEVELS)[number];

export const levelOf = (pct: number | null): Level | null => (pct === null ? null : LEVELS.find((l) => pct >= l.min) ?? null);

export type PanoramaRow = {
  project: ProjectDoc;
  previstas: MeasurementDoc[];
  realizadas: MeasurementDoc[];
  atrasadas: MeasurementDoc[];
  avaliadas: MeasurementDoc[];
  atingidas: MeasurementDoc[];
  pct: number | null;
  level: Level | null;
};

/** Medições do tipo escolhido com prazo até a data limite, por projeto. */
export function buildPanorama(m: Model, kind: 'KR' | 'KPI', limit: string, projectIds: string[], start = ''): PanoramaRow[] {
  const kindOf = (x: MeasurementDoc) => typeKind(m.indicatorsOf(x)[0]?.tipo ?? null);
  return m.ds.projects
    .filter((p) => projectIds.length === 0 || projectIds.includes(p.boardId))
    .map((project) => {
      const previstas = m.ds.measurements.filter((x) =>
        x.projectBoardId === project.boardId && !isDiscarded(x.statusMedicao) && !m.isExcluded(x)
        && kindOf(x) === kind && !!x.prazo && x.prazo.slice(0, 10) <= limit && (!start || x.prazo.slice(0, 10) >= start));
      const realizadas = previstas.filter(m.isConcluded);
      const atrasadas = previstas.filter(m.isLate);
      // Atrasadas contam como meta não batida (entram no denominador, nunca no numerador).
      const avaliadas = previstas.filter((x) => m.goalClass(x) !== 'none');
      const atingidas = avaliadas.filter((x) => m.goalClass(x) === 'reached');
      const pct = avaliadas.length ? (atingidas.length / avaliadas.length) * 100 : null;
      return { project, previstas, realizadas, atrasadas, avaliadas, atingidas, pct, level: levelOf(pct) };
    })
    .filter((r) => r.previstas.length > 0)
    .sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
}
