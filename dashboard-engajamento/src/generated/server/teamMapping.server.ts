import { db } from '@vibe/db/server';
import {
  legacyTeamMappingCollection,
  teamMappingMetaCollection,
  teamProjectRowsCollection,
} from '@generated/models';
import { NOT_A_PROJECT_FLAG } from '@generated/lib/projectMatcher';

const SEED_META_DOC_ID = 'seed';
const LEGACY_DOC_ID = 'main_team_mapping';

// Carga inicial (usada uma única vez, na primeira execução)
const SEED_ROWS: [string, string][] = [
  ['[SE] GA', '2024/058 [SE | SEDUC SE] Gestão para aprendizagem'],
  ['Gestão GA SE', '2024/058 [SE | SEDUC SE] Gestão para aprendizagem'],
  ['[RJ] GA + GE', '2025/106 [RJ | SEEDUC Rio de Janeiro] Gestão para Aprendizagem + Gestão Estratégica | Fase 02'],
  ['[MS] GA', '2023/037 [MS | SEDUC MS] Gestão para aprendizagem'],
  ['[BA] GA | Fase 02', '2024/013 [BA | SEC BA] Gestão para aprendizagem | Fase 02'],
  ['[RN] GA', '2026/002 [RN | SEEC RN] Gestão para Aprendizagem + Regime de Progressão Parcial | Fase 02'],
  ['[AL] EPT + GA | Fase 02', '2025/010 [AL | SEDUC AL] Educação Profissional e Tecnológica + Gestão para a Aprendizagem | Fase 02'],
  ['[SE] PBA', '2025/074 [SE | SEED SE] PBA | Fase 02'],
  ['[SE] CNCA Formação', '2026/022 [SE | SEED SE] CNCA Formação | Fase 02'],
  ['[PR] CNCA Formação', '2025/046 [PR | SEED PR] CNCA Formação'],
  ['[RN] CNCA Formação', '2025/095 [RN | SEEC RN] CNCA Formação | Fase 02'],
  ['[MS] CNCA Formação', '2024/029 [MS | SEDUC MS] CNCA Formação'],
  ['[SP] CNCA Formação', '2025/030 [SP | SEDUC SP] CNCA Formação'],
  ['[GO] CNCA Formação', '2025/026 [GO | SEDUC GO] CNCA Formação'],
  ['[MA] CNCA Formação', '2025/059 [MA | SEDUC MA] CNCA Formação | Fase 02'],
  ['[MT] CNCA Formação', '2024/065 [MT | SEDUC MT] CNCA Formação'],
  ['[PA] CNCA Formação + Material', '2025/094 [PA | SEDUC PA] CNCA Formação + Material | Fase 02'],
  ['[PI] CNCA Formação + Material', '2025/078 [PI | SEDUC PI] CNCA Formação + Material | RAF'],
  ['[MT] Sistema Estruturado de Ensino', '2026/056 [MT | SEDUC MT] Sistema Estruturado de Ensino | Aditivo 06'],
  ['[BR] PAR 5 | Aditivo 01', '2025/050 [BR | MEC] PAR 5 | Aditivo 01'],
  ['[BR | GIZ | MMA] Plano clima', '2026/023 [BR | MF] Cooperação técnica para implementação do Plano de Transformação Ecológica - PTE | Fase 02'],
  ['[BR | MF] Cooperação técnica PTE', '2026/023 [BR | MF] Cooperação técnica para implementação do Plano de Transformação Ecológica - PTE | Fase 02'],
  ['[PA] Eventos Formativos', '2026/027 [PA | SEDUC PA] Eventos Formativos + Gestão de Regionais'],
  ['[SP] Formação de Gestores', '2025/098 [SP | EFAPE SP] Escola de Gestores | Fase 02'],
  ['[SP] Formação de Gestores - Pedagógico', '2025/098 [SP | EFAPE SP] Escola de Gestores | Fase 02'],
  ['[SP] Certificação PECs', '2025/092 [SP | SEDUC SP] Certificação PECs'],
  ['[PA | Parauapebas] Desenvolvimento Institucional', '2025/039 [PA | Vale | PM Parauapebas] Desenvolvimento Institucional'],
  ['[MA] Trilhos da Alfabetização', '2025/089 [PA | FV | SME] Trilhos da Alfabetização | Aditivo 02'],
  ['[PA] Trilhos da Alfabetização', '2025/089 [PA | FV | SME] Trilhos da Alfabetização | Aditivo 02'],
  ['[PA] FV EJA', '2026/009 [PA | FV | SME] Educação de Jovens e Adultos do Ensino Médio'],
  ['[TO] Gestão de Regionais', '2024/050 [TO | SEDUC TO] Gestão de regionais'],
  ['[BR] SEBRAE', '2025/083 [BR | SEBRAE] Educação Empreendedora | Fase 02'],
  ['[BR | CARF] Inteligência artificial', '2026/026 [BR | CARF] Inteligência Artificial | Aditivo'],
  ['CARF - Especialistas', '2026/026 [BR | CARF] Inteligência Artificial | Aditivo'],
  ['[INT] Silicon Valley', '2025/086 [INT | SILICON VALLEY] Expand the strategic adoption of AI'],
  ['[BR] Prêmio Monografia Tesouro Nacional', '2025/044 [BR | STN] Prêmio Monografia Tesouro Nacional'],
  ['[BR | IU] Orçamento Público', '2024/053 [BR | IU] Orçamento Público'],
  ['[RN | IET | SEEC Rio Grande do Norte] Educação Profissional e Tecnológica', '2025/108 [RN | IET | SEEC Rio Grande do Norte] Educação Profissional e Tecnológica'],
  ['[BR | RN e PI] EPT', '2025/108 [RN | IET | SEEC Rio Grande do Norte] Educação Profissional e Tecnológica'],
];

export interface TeamMappingRowView {
  id: string;
  equipe: string;
  projeto: string;
}

/** Faz a carga inicial uma única vez; depois a coleção é a única fonte */
async function ensureSeeded(): Promise<void> {
  const meta = await db.collection(teamMappingMetaCollection).doc(SEED_META_DOC_ID).get();
  if (meta?.data?.seededAt) return;

  // Se houver o formato antigo (com edições do usuário), ele tem prioridade sobre a carga do código
  let seed: [string, string][] = SEED_ROWS;
  try {
    const legacy = await db.collection(legacyTeamMappingCollection).doc(LEGACY_DOC_ID).get();
    const map = legacy?.data?.mapping;
    if (map && Object.keys(map).length > 0) {
      seed = Object.entries(map).map(([k, v]) => [k, v === '__NOT_A_PROJECT__' ? NOT_A_PROJECT_FLAG : v]);
    }
  } catch (e) {
    console.error('Erro ao ler de-para antigo:', e);
  }

  const now = new Date().toISOString();
  for (const [equipe, projeto] of seed) {
    await db.collection(teamProjectRowsCollection).add({ equipe, projeto, updatedAt: now, updatedBy: 'Carga inicial' });
  }
  await db.collection(teamMappingMetaCollection).doc(SEED_META_DOC_ID).set({ seededAt: now });
}

export async function loadTeamMappingRows(): Promise<TeamMappingRowView[]> {
  await ensureSeeded();
  const out: TeamMappingRowView[] = [];
  let cursor: string | undefined = undefined;
  let guard = 0;
  do {
    const base = db.collection(teamProjectRowsCollection).limit(500);
    const page: Awaited<ReturnType<typeof base.getPage>> = cursor
      ? await base.startAfter(cursor).getPage()
      : await base.getPage();
    page.docs.forEach((d) => out.push({ id: d.id, equipe: d.data.equipe, projeto: d.data.projeto }));
    cursor = page.cursor;
    guard++;
  } while (cursor && guard < 50);
  return out.sort((a, b) => a.equipe.localeCompare(b.equipe));
}

export function rowsToTable(rows: TeamMappingRowView[]): Record<string, string> {
  const table: Record<string, string> = {};
  rows.forEach((r) => {
    table[r.equipe] = r.projeto;
  });
  return table;
}
