export async function loadPendingModule<TModule>(specifier: string): Promise<TModule> {
  return (await import(specifier)) as TModule;
}
