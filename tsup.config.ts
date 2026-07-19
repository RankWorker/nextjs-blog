import { defineConfig } from "tsup";

const sharedOptions = {
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ["next", "react", "react-dom", "@rankworker/nextjs-blog/faq"],
  banner: {
    js: "/* @rankworker/nextjs-blog */",
  },
};

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      app: "src/app.tsx",
      components: "src/components.ts",
      static: "src/static.ts",
      "static-app": "src/static-app.ts",
      "next-config": "src/next-config.ts",
      cli: "src/cli/index.ts",
      styles: "src/styles.css",
    },
    format: ["esm"],
    dts: true,
    clean: false,
    ...sharedOptions,
  },
  {
    entry: { "next-config": "src/next-config.ts" },
    format: ["cjs"],
    dts: true,
    clean: false,
    outExtension: () => ({ js: ".cjs" }),
    ...sharedOptions,
  },
  {
    entry: { faq: "src/faq.tsx" },
    format: ["esm"],
    dts: true,
    clean: false,
    ...sharedOptions,
  },
]);
