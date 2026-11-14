// Datas como 'AAAA-MM-DD' e dias como número inteiro (UTC), para não sofrer com fuso.
export const dia = (iso: string) => (iso ? Math.floor(Date.parse(iso.slice(0, 10) + 'T00:00:00Z') / 86400000) : NaN);
export const isoDe = (d: number) => new Date(d * 86400000).toISOString().slice(0, 10);
export const ano = (iso: string) => Number(iso.slice(0, 4));
export const ddmm = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
export const ddmmaa = (iso: string) => (iso ? `${ddmm(iso)}/${iso.slice(2, 4)}` : '');
export const ddmmaaaa = (iso: string) => (iso ? `${ddmm(iso)}/${iso.slice(0, 4)}` : '');

/** "16/06–16/10", "24–30/11" ou "18/11". */
export function faixa(datas: string[]): string {
  const d = datas.filter(Boolean).sort();
  if (!d.length) return '-';
  const a = d[0], b = d[d.length - 1];
  if (a === b) return ddmm(a);
  if (a.slice(0, 7) === b.slice(0, 7)) return `${a.slice(8, 10)}–${ddmm(b)}`;
  return `${ddmm(a)}–${ddmm(b)}`;
}

export function mi(v: number): string {
  const m = v / 1e6;
  const casas = m > 0 && m < 0.1 ? 2 : 1;
  return `R$ ${m.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })} mi`;
}

export const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function lista(xs: string[]): string {
  const u = xs.filter(Boolean);
  if (u.length <= 1) return u.join('');
  return `${u.slice(0, -1).join(', ')} e ${u[u.length - 1]}`;
}

export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** Corta no limite de palavra, sem reticências. */
export function corta(s: string, n: number): string {
  if (s.length <= n) return s;
  const c = s.slice(0, n + 1);
  const k = c.lastIndexOf(' ');
  let out = (k > n * 0.5 ? c.slice(0, k) : s.slice(0, n)).replace(/[\s,;:(\-–]+$/, '');
  while (/\s(de|do|da|dos|das|e|para|a|o|em|com|no|na)$/i.test(out)) out = out.replace(/\s\S+$/, '');
  return out;
}

/** "1 item", "6 itens", "1 projeto", "2 projetos". */
export const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Código do projeto ("2024/013") para casar os dois quadros. */
export const codigo = (nome: string) => nome.match(/\d{4}\/\d{3}/)?.[0] ?? nome.trim();

const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO BR INT'.split(' '));
const ORGAO = /^(SEDUC|SEED|SEEDUC|SEEC|SEC|SED|SEE|SME|PM|GOV|SEME|SEMAG|SEDEICS|EFAPE|FV|IU|IET|BID|GIZ|ABDE|MEC|Vale)\b\s*/i;
const LIMITE = 22;

/** Nome curto sem cortes: "2024/013 [BA | SEC BA] Gestão para aprendizagem | Fase 02" -> "BA GA F2". */
export function curto(nome: string): string {
  if (!nome) return 'Sem projeto';
  const m = nome.match(/\[([^\]]+)\]\s*(.*)$/);
  if (!m) return corta(nome.replace(/^\d{4}\/\d{3}\s*/, ''), 32);
  const partes = m[1].split('|').map((s) => s.trim()).filter(Boolean);
  const uf = partes[0];
  let pre = uf;
  if (/^(BR|INT|Nacional)$/i.test(uf)) pre = partes[partes.length - 1];
  if (/silicon valley/i.test(pre)) pre = 'Silicon Valley';
  const orig = m[2];
  const fase = [orig.match(/Fase 0?(\d+)/i)?.[1] ? `F${orig.match(/Fase 0?(\d+)/i)![1]}` : '', orig.match(/Aditivo 0?(\d+)/i) ? `Ad. ${orig.match(/Aditivo 0?(\d+)/i)![1]}` : /Aditivo/i.test(orig) ? 'Ad.' : ''].filter(Boolean).join(' ');
  let t = orig;
  const regras: [RegExp, string][] = [
    [/Educação Profissional e Tecnológica/gi, 'EPT'], [/Política de EPT/gi, 'EPT'],
    [/Gestão para (a )?aprendizagem/gi, 'GA'], [/Gestão estratégica/gi, 'GE'],
    [/Regime de Progressão Parcial/gi, 'RPP'], [/Educação de Jovens e Adultos( do Ensino Médio)?/gi, 'EJA'],
    [/CNCA Formação \+ Material/gi, 'CNCA'], [/CNCA Formação/gi, 'CNCA'], [/Inteligência artificial/gi, 'IA'],
    [/Sistema estruturado de ensino de Mato Grosso/gi, 'Sistema Estruturado'], [/Trilhos da Alfabetização/gi, 'Trilhos'],
    [/Formação de gestores escolares/gi, 'Gestores Escolares'], [/Formação de diretores regionais/gi, 'Diretores Regionais'],
    [/Formação de professores ensino médio/gi, 'Professores EM'], [/Análise do Programa Maranhão Livre da Fome/gi, 'Maranhão Livre da Fome'],
    [/Fase 0?\d+/gi, ''], [/Aditivo( 0?\d+)?/gi, ''], [/Expand the strategic adoption of AI/gi, ''],
    [/\s*\+\s*/g, '+'], [/\s*[|\-–]\s*/g, ' '], [/\s+/g, ' '],
  ];
  for (const [re, r] of regras) t = t.replace(re, r);
  t = t.trim();
  const junta = (...xs: string[]) => [...new Set(xs.filter(Boolean))].join(' ').replace(/\s+/g, ' ').trim();
  const c1 = junta(pre, t, fase);
  if (c1.length <= LIMITE) return c1;
  // sigla presente no título (PTE, PAR, PECs, EPT, CNCA...)
  const sigla = orig.match(/\b([A-Z]{2,}[a-z]?s?)\b/g)?.find((x) => !UFS.has(x) && !/^(II|III|IV)$/.test(x));
  if (sigla && junta(pre, sigla, fase).length <= LIMITE) return junta(pre, sigla, fase);
  // órgão/município do colchete: "SP FDE", "PA Parauapebas", "SEBRAE F2"
  const org = partes.slice(1).map((p) => p.replace(ORGAO, '').trim()).filter((p) => p && !UFS.has(p)).pop();
  if (org && junta(pre === org ? '' : uf === 'BR' || uf === 'INT' ? '' : uf, org, fase).length <= LIMITE) return junta(pre === org ? '' : /^(BR|INT|Nacional)$/i.test(uf) ? '' : uf, org, fase);
  return junta(corta(junta(pre, t), LIMITE - fase.length - 1), fase);
}

/** "Maria Emília Mousinho Lins e Silva" -> "Maria Emília"; "Tullio Monteiro Prota" -> "Tullio". */
export function primeiroNome(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '';
  return /^(maria|ana|joão|jose|josé)$/i.test(p[0]) && p[1] ? `${p[0]} ${p[1]}` : p[0];
}

/** "Gabriel Guedes Gama de Lima, TAMIRES MATOS DE PAULA GONCALVES" -> "Gabriel Lima / Tamires Goncalves". */
export function pessoas(txt: string): string {
  const tc = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  return txt.split(',').map((n) => n.trim().split(/\s+/)).filter((p) => p[0])
    .map((p) => tc(p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : p[0])).slice(0, 2).join(' / ') || '-';
}

/** Encurta a pendência sem deixar frase pela metade: tira etiquetas como "[Riscos]" e corta no fim de uma oração. */
export function resumoPendencia(nome: string, max: number): string {
  const limpa = (s: string) => {
    let o = s.replace(/[\s.;:,(\-–—]+$/, '');
    while (/\s(de|do|da|dos|das|e|para|a|o|os|as|em|com|no|na|nos|nas|que|como|ao|sem|se|qual|algum|alguma|não|um|uma|pelo|pela|pelos|pelas|à|às|aos|seu|sua)$/i.test(o)) o = o.replace(/\s\S+$/, '');
    return o;
  };
  const t = cap(nome.replace(/^\s*(\[[^\]]*\]\s*)+/, '').replace(/\s+/g, ' ').trim());
  if (t.length <= max) return t.replace(/[.;:,]$/, '');
  // 1) junta orações inteiras, mantendo a pontuação original
  const partes = t.split(/((?<=[.;:])\s+|,\s+|\s[-–—]\s|\s(?=\())/);
  let out = '';
  for (let k = 0; k < partes.length; k += 2) {
    const novo = out + (k ? partes[k - 1] : '') + partes[k];
    if (novo.length > max) break;
    out = novo;
  }
  out = limpa(out);
  if (out.length >= 20) return out;
  // 2) frase longa sem pausa: corta antes do último conector que cabe
  const conectores = /\s(e|para|com|que|incluindo|necessári[oa]s?|conforme|de acordo|a fim|visando|junto|considerando|sobre|após|até|quando|onde|antes)\s/gi;
  let corte = -1;
  for (const m of t.matchAll(conectores)) if (m.index! >= 20 && m.index! <= max) corte = m.index!;
  if (corte > 0) return limpa(t.slice(0, corte));
  return limpa(corta(t, max));
}
