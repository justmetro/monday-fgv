// No monday code não há proxy de sessão do Vibe: as consultas ao servidor usam o token pessoal cadastrado.
export default async function getServerApiClient(): Promise<{ client: { request: (q: string, v?: unknown) => Promise<unknown> } }> {
  const err = new Error('Nenhum token pessoal cadastrado. Cadastre o seu token na tela Importação e atualização.') as Error & { response?: unknown };
  err.response = { errors: [{ message: 'missing vibe-auth session', extensions: { code: 'UNAUTHENTICATED', status_code: 401 } }] };
  throw err;
}
