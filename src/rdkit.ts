import initRDKitModule from '@rdkit/rdkit';
import type { RDKitModule } from '@rdkit/rdkit';

let initPromise: Promise<RDKitModule> | null = null;

/**
 * Load the RDKit WebAssembly module and attach it to window.RDKit.
 */
export function loadRDKit(): Promise<RDKitModule> {
  if (window.RDKit) {
    return Promise.resolve(window.RDKit);
  }
  if (!initPromise) {
    initPromise = initRDKitModule().then((instance) => {
      window.RDKit = instance;
      console.log('RDKit version:', instance.version());
      return instance;
    });
  }
  return initPromise;
}
