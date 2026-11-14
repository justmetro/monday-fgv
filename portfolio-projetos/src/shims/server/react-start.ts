// Servidor: registra cada função para ser chamada via POST /_fn/:id.
export const registry = new Map<string, (data: unknown) => Promise<unknown>>();
export function createServerFn(id: any, _opts?: unknown) {
  let validator: any = null;
  const b = {
    validator(v: unknown) { validator = v; return b; },
    inputValidator(v: unknown) { validator = v; return b; },
    middleware(_m: unknown) { return b; },
    handler<O>(h: (ctx: { data: any }) => Promise<O> | O) {
      const run = async (raw: unknown) => {
        const data = validator?.parse ? validator.parse(raw ?? undefined) : raw;
        return h({ data });
      };
      registry.set(id, run);
      const f = (arg?: { data?: unknown }) => run(arg?.data);
      return f as (arg?: { data?: any }) => Promise<O>;
    },
  };
  return b;
}
