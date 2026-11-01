import {defineConfig} from 'tsdown';

// Bundles the package into one module with its type declarations; npm
// dependencies stay external.
export default defineConfig({
  outDir: 'build',
  tsconfig: 'tsconfig.build.json',
  dts: true,
  fixedExtension: false,
});
