/**
 * La charte des interfaces MC. Sobre, volontairement : ce sont des outils
 * internes, pas des pages de présentation.
 *
 * Une seule couleur vive par écran — l'action principale. Tout le reste est neutre.
 */
export const tokens = {
    color: {
        ground: '#F6F7F9', // fond de page, gris très clair légèrement bleuté
        surface: '#FFFFFF',
        border: '#DFE3E9',
        ink: '#161A21', // texte principal
        inkSoft: '#5A6472', // texte secondaire
        inkFaint: '#8A93A1', // mentions, métadonnées
        accent: '#1C85C7', // bleu ATRAIT — boutons, états actifs
        accentInk: '#12719E', // même bleu, contraste AA sur blanc — liens et texte
        accentWash: '#EAF4FA',
        ok: '#2C7A5A',
        warn: '#9A6712',
        stop: '#B3402F',
    },
    radius: { sm: '6px', md: '10px', lg: '14px' },
    font: {
        sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        mono: "'IBM Plex Mono', ui-monospace, 'SF Mono', monospace",
    },
    space: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '40px' },
};
