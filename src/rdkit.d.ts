import type { RDKitModule, RDKitLoader } from '@rdkit/rdkit';

declare module '@rdkit/rdkit/dist/RDKit_minimal.js';

declare global {
    interface Window {
        RDKit?: RDKitModule;
        initRDKitModule: RDKitLoader;
    }
}

export { };
