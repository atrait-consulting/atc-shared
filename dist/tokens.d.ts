/**
 * La charte des interfaces MC. Sobre, volontairement : ce sont des outils
 * internes, pas des pages de présentation.
 *
 * Une seule couleur vive par écran — l'action principale. Tout le reste est neutre.
 */
export declare const tokens: {
    readonly color: {
        readonly ground: "#F6F7F9";
        readonly surface: "#FFFFFF";
        readonly border: "#DFE3E9";
        readonly ink: "#161A21";
        readonly inkSoft: "#5A6472";
        readonly inkFaint: "#8A93A1";
        readonly accent: "#1C85C7";
        readonly accentInk: "#12719E";
        readonly accentWash: "#EAF4FA";
        readonly ok: "#2C7A5A";
        readonly warn: "#9A6712";
        readonly stop: "#B3402F";
    };
    readonly radius: {
        readonly sm: "6px";
        readonly md: "10px";
        readonly lg: "14px";
    };
    readonly font: {
        readonly sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        readonly mono: "'IBM Plex Mono', ui-monospace, 'SF Mono', monospace";
    };
    readonly space: {
        readonly xs: "4px";
        readonly sm: "8px";
        readonly md: "16px";
        readonly lg: "24px";
        readonly xl: "40px";
    };
};
export type AtcTokens = typeof tokens;
