/** Texto de erro seguro para tela e log: respostas HTML do gateway (502/503/504) viram uma frase curta. */
export function errorText(e: unknown, fallback = 'Falha inesperada.'): string {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  if (!raw) return fallback;
  const looksHtml =
    /<\s*(html|body|head)|@font-face|Bad gateway|Cloudflare|CloudFront|Ray ID|could not be satisfied|Gateway Time-?out|HTTP 50[234]|\b50[234] ERROR/i.test(raw);
  if (looksHtml) {
    return 'O servidor demorou demais ou ficou indisponível por instantes (erro 502/504). Aguarde alguns segundos e tente de novo; a importação pode ter sido concluída, confira os dados antes de repetir.';
  }
  return raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
}
