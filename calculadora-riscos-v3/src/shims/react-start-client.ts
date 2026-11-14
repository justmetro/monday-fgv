// createServerFn do Vibe executado no próprio navegador: valida a entrada e chama o handler.
type Validator = { parse: (v: unknown) => unknown } | ((v: unknown) => unknown);
export function createServerFn(_opts?: unknown) {
  let validator: Validator | null = null;
  const b = {
    validator(v: Validator) { validator = v; return b; },
    inputValidator(v: Validator) { validator = v; return b; },
    middleware(_m: unknown) { return b; },
    handler<O>(h: (ctx: { data: any }) => Promise<O> | O) {
      return async (opts?: { data?: any }): Promise<O> => {
        let data: unknown = opts?.data;
        if (validator) data = typeof validator === 'function' ? (validator as (v: unknown) => unknown)(data) : validator.parse(data);
        return h({ data });
      };
    },
  };
  return b;
}
