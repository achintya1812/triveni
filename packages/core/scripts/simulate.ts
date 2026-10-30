import { defaultOptions, formatResults, simulate } from "../src/simulate";

// Prints how often the rules find each planted cause. Options: --classes N --children N --careless P --seed N
const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : undefined;
};
const options = {
  ...defaultOptions,
  classes: option("classes") ?? defaultOptions.classes,
  childrenPerClass: option("children") ?? defaultOptions.childrenPerClass,
  careless: option("careless") ?? defaultOptions.careless,
  seed: option("seed") ?? defaultOptions.seed,
};
const started = Date.now();
console.log(formatResults(simulate(options), options));
console.log(`\nRan in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
