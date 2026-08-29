#!/usr/bin/env node
/**
 * Pose les pièces communes de la charte dans un fichier, entre leurs marqueurs.
 *
 * Usage : node appliquer.mjs <fichier> [<fichier>…]
 *
 * Deux pièces à ce jour :
 *   ATC-THEME  — les jetons (atc.css)
 *   ATC-RAIL   — la colonne de navigation (rail.css)
 *
 * Un fichier ne reçoit que les pièces dont il porte les marqueurs : le portail
 * a sa propre colonne rendue par React et n'a donc pas besoin de la seconde.
 *
 * Le bloc est REMPLACÉ, jamais fusionné : une charte qu'on fusionne est une
 * charte qui garde les vieilles valeurs à côté des neuves. Et si les marqueurs
 * manquent, le script le dit sans rien toucher — mieux vaut un message qu'une
 * insertion au mauvais endroit dans une page de cinq mille lignes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));

const PIECES = [
  { nom: 'ATC-THEME', source: 'atc.css' },
  { nom: 'ATC-RAIL', source: 'rail.css' },
];

function extraire(piece) {
  const debut = `/* ==${piece.nom}:DÉBUT== */`;
  const fin = `/* ==${piece.nom}:FIN== */`;
  const texte = readFileSync(resolve(ICI, piece.source), 'utf8');
  const a = texte.indexOf(debut);
  const b = texte.indexOf(fin);
  if (a < 0 || b < 0) {
    console.error(`${piece.source} a perdu ses marqueurs ${piece.nom}.`);
    process.exit(1);
  }
  return { debut, fin, bloc: texte.slice(a, b + fin.length) };
}

const blocs = PIECES.map((p) => ({ ...p, ...extraire(p) }));

const cibles = process.argv.slice(2);
if (!cibles.length) {
  console.error('Aucun fichier à mettre à jour.');
  process.exit(1);
}

let change = 0;
for (const chemin of cibles) {
  let texte = readFileSync(chemin, 'utf8');
  const avant = texte;
  const posees = [];
  let manquantes = 0;

  for (const p of blocs) {
    const a = texte.indexOf(p.debut);
    const b = texte.indexOf(p.fin);
    if (a < 0 || b < 0) { manquantes++; continue; }
    texte = texte.slice(0, a) + p.bloc + texte.slice(b + p.fin.length);
    posees.push(p.nom);
  }

  if (!posees.length) {
    console.error(`✗ ${chemin} — aucun marqueur reconnu, fichier laissé tel quel.`);
    process.exitCode = 1;
    continue;
  }
  if (texte === avant) {
    console.log(`· ${chemin} — déjà à jour (${posees.join(', ')})`);
    continue;
  }
  writeFileSync(chemin, texte);
  console.log(`✓ ${chemin} — ${posees.join(', ')}`);
  change++;
}
if (change) console.log(`\n${change} fichier(s) mis à jour. Relisez le diff avant de livrer.`);
