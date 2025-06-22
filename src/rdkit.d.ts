declare module '@rdkit/rdkit' {
  const initRDKitModule: () => Promise<any>;
  export default initRDKitModule;
}