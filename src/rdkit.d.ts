import type { RDKitModule, RDKitLoader } from '@rdkit/rdkit';

declare global {
  interface Window {
    RDKit?: RDKitModule;
    initRDKitModule: RDKitLoader;
  }
}

export {};
