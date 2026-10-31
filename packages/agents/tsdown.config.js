import {defineConfig} from 'tsdown';

// Only @gamecrafters/agents is published, so it carries agents-core inside
// its code and type declarations; npm dependencies stay external.
export default defineConfig({
  outDir: 'build',
  tsconfig: 'tsconfig.build.json',
  dts: true,
  fixedExtension: false,
  deps: {alwaysBundle: ['@gamecrafters/agents-core']},
});
