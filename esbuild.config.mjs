import esbuild from "esbuild";

const production = process.argv.includes("production");

await esbuild
  .build({
    banner: {
      js: "/* Extaggerated */"
    },
    bundle: true,
    define: {
      "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development")
    },
    entryPoints: ["src/main.ts"],
    external: ["obsidian", "electron", "@codemirror/*"],
    format: "cjs",
    logLevel: "info",
    minify: production,
    outfile: "main.js",
    platform: "browser",
    sourcemap: production ? false : "inline",
    target: "es2022",
    treeShaking: true
  })
  .catch(() => process.exit(1));
