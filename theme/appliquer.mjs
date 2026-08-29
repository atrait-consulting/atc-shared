#!/usr/bin/env node
/**
 * Pose la charte MC dans un fichier, entre ses deux marqueurs.
 *
 * Usage : node appliquer.mjs <fichier> [<fichier>…]
 *
 * Chaque application appelle ce script sur ses feuilles de style par
 * `npm run theme`. Le bloc est REMPLACÉ, jamais fusionné : une charte qu'on
 * fusionne est une charte qui garde les vieilles valeurs à côté des neuves.
 *
 * Si les marqueurs manquent, le script le dit et ne touche à rien. Il vaut
 * mieux un message que l'insertion d'un bloc au mauvais endroit — dans une
 * page de cinq mille lignes, on ne s'en apercevrait pas avant l'écran.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const DEBUT = '/* ==ATC-THEME:DÉBUT== */';
const FIN = '/* ==ATC-THEME:FIN== */';

const source = readFileSync(resolve(ICI, 'atc.css'), 'utf8');
const d = source.indexOf(DEBUT);
const f = source.indexOf(FIN);
if (d < 0 || f < 0) {
  console.error('atc.css a perdu ses marqueurs.');
  process.exit(1);
}
const bloc = source.slice(d, f + FIN.length);

const cibles = process.argv.slice(2);
if (!cibles.length) {
  console.error('Aucun fichier à mettre à jour.');
  process.exit(1);
}

let change = 0;
for (const chemin of cibles) {
  const texte = readFileSync(chemin, 'utf8');
  const a = texte.indexOf(DEBUT);
  const b = texte.indexOf(FIN);
  if (a < 0 || b < 0) {
    console.error(`✗ ${chemin} — marqueurs ATC-THEME absents, fichier laissé tel quel.`);
    process.exitCode = 1;
    continue;
  }
  const neuf = texte.slice(0, a) + bloc + texte.slice(b + FIN.length);
  if (neuf === texte) {
    console.log(`· ${chemin} — déjà à jour`);
    continue;
  }
  writeFileSync(chemin, neuf);
  console.log(`✓ ${chemin} — charte posée`);
  change++;
}
if (change) console.log(`\n${change} fichier(s) mis à jour. Relisez le diff avant de livrer.`);
