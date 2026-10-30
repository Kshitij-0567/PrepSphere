// Excalidraw reads this when its module is first evaluated, so it must be set by a module that is
// imported before '@excalidraw/excalidraw'. Its fonts are then served from this site (see
// vite.config.js) instead of a third-party CDN, which the Content-Security-Policy also blocks.
window.EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/';
