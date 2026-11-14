export function serverFnStub(id: string) {
  return () => Promise.reject(new Error(`Sem servidor: ${id}`));
}
export function createServerFn(_opts?: unknown) {
  const b = { validator: (_v: unknown) => b, inputValidator: (_v: unknown) => b, middleware: (_m: unknown) => b, handler: (_h: unknown) => serverFnStub('unknown') };
  return b;
}
