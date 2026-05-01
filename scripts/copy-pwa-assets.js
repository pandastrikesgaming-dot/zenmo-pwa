const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const pdfWorkerSource = path.join(
  root,
  'node_modules',
  'pdfjs-dist',
  'legacy',
  'build',
  'pdf.worker.min.mjs'
);
const pdfWorkerPublicTarget = path.join(publicDir, 'pdf.worker.min.mjs');

function copyRecursive(source, destination) {
  if (!fs.existsSync(source)) {
    return;
  }

  const stats = fs.statSync(source);

  if (stats.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });

    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(destination, entry));
    }

    return;
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

copyRecursive(pdfWorkerSource, pdfWorkerPublicTarget);
copyRecursive(publicDir, distDir);

const indexPath = path.join(distDir, 'index.html');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  const headTags = [
    '<link rel="manifest" href="/manifest.json">',
    '<link rel="apple-touch-icon" href="/icons/icon-192.png">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-title" content="Zenmo">',
  ];

  for (const tag of headTags) {
    if (!html.includes(tag)) {
      html = html.replace('</head>', `${tag}\n</head>`);
    }
  }

  fs.writeFileSync(indexPath, html);
}

console.log('[pwa] copied public PWA assets to dist');
