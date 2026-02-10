const { generateSW } = require("workbox-build");

generateSW({
  globDirectory: "dist/",
  globPatterns: ["**/*.{js,html,css,ttf,ico,json,png,svg}"],
  swDest: "dist/sw.js",
  skipWaiting: true,
  clientsClaim: true,
}).then(({ count, size }) => {
  console.log(
    `Generated sw.js, which will precache ${count} files, totaling ${(size / 1024).toFixed(1)} kB.`
  );
});
