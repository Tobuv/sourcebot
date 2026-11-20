/**
 * NexusCode brand mark: a hexagon whose centre node is connected to three of
 * its corners. Drawn on a 24×24 grid with `currentColor`, so it follows the
 * surrounding text colour (and therefore light / dark mode).
 *
 * Keep in sync with `scripts/generateBrandAssets.mjs`, which renders the
 * same shapes into the PNG icons (favicon, app icon, share images).
 */
export const NexusCodeMarkShapes = () => (
    <g fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12,2 20.66,7 20.66,17 12,22 3.34,17 3.34,7" />
        <line x1="12" y1="12" x2="12" y2="2" />
        <line x1="12" y1="12" x2="20.66" y2="17" />
        <line x1="12" y1="12" x2="3.34" y2="17" />
        <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
        <circle cx="12" cy="2" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="20.66" cy="17" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="3.34" cy="17" r="1.7" fill="currentColor" stroke="none" />
    </g>
);
