import reactPlugin from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import packageJson from "./package.json";
import { viteExternalsPlugin } from "vite-plugin-externals";
import removeConsole from "vite-plugin-remove-console";

const getPackageName = () => {
  return packageJson.name;
};
console.log(process.env.NODE_ENV, " ---");

const getPackageNameCamelCase = () => {
  try {
    return getPackageName().replace(/-./g, (char) => char[1].toUpperCase());
  } catch (err) {
    throw new Error("Name property in package.json is missing.");
  }
};

const isDev = process.env.NODE_ENV === "dev";

const build = isDev
  ? {
    //   watch: {},
    }
  : {};

const fileName = {
  es: `extension.js`,
  //   cjs: `${getPackageName()}.cjs`,
  //   iife: `${getPackageName()}.iife.js`,
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    reactPlugin({
      jsxRuntime: "classic",
    }),
    isDev ? undefined : removeConsole(),
    viteExternalsPlugin({
      "@blueprintjs/core": ["Blueprint", "Core"],
      "@blueprintjs/datetime": ["Blueprint", "DateTime"],
      "@blueprintjs/select": ["Blueprint", "Select"],
      "chrono-node": "ChronoNode",
      crypto: "crypto",
      "crypto-js": "CryptoJS",
      "file-saver": "FileSaver",
      jszip: ["RoamLazy", "JSZip"],
      idb: "idb",
      marked: ["RoamLazy", "Marked"],
      "marked-react": ["RoamLazy", "MarkedReact"],
      nanoid: "Nanoid",
      react: "React",
      "react-dom": "ReactDOM",
      "react-dom/client": "ReactDOM",
      tslib: "TSLib",
    }),
  ],
  //   base: "./",
  //   // Makes HMR available for development
  base: "./",

  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.tsx"),
      name: getPackageNameCamelCase(),
      formats: ["es"],
      fileName: (format) => fileName[format],
    },
    outDir: "./",
    minify: true,
    rollupOptions: {
      output: {
        assetFileNames: "extension.[ext]",
      },
    },
    sourcemap: true,
    ...build,
  },
  logLevel: "error",
});
