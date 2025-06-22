import type { RDKitModule, RDKitLoader } from '@rdkit/rdkit';
// The published type definitions do not declare a default export, but the
// library actually exposes one. Use `require` and cast to the correct type to
// keep TypeScript happy without copying the entire declaration file.
const initRDKitModule: RDKitLoader = require('@rdkit/rdkit');

let initPromise: Promise<RDKitModule> | null = null;

/**
 * Load the RDKit WebAssembly module and attach it to window.RDKit.
 */
export function loadRDKit(): Promise<RDKitModule> {
  if ((window as any).RDKit) {
    return Promise.resolve((window as any).RDKit as RDKitModule);
  }
  if (!initPromise) {
    initPromise = initRDKitModule({
      locateFile: () => `${process.env.PUBLIC_URL || ''}/static/js/RDKit_minimal.wasm`,
    }).then((instance: RDKitModule) => {
      (window as any).RDKit = instance;
      console.log('RDKit version:', instance.version());
      return instance;
    });
  }
  return initPromise!;
}
