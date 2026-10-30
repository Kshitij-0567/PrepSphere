// Must stay the first import: it tells Excalidraw where its fonts are before Excalidraw loads.
import './lib/excalidrawAssets';
import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { readDraft, writeDraft } from './lib/delivery';

const UI_OPTIONS = {
    canvasActions: {
        loadScene: false, saveToActiveFile: false, export: false, saveAsImage: false,
        toggleTheme: false, changeViewBackgroundColor: false, clearCanvas: true,
    },
    tools: { image: false },
};
const MAX_EXPORT_SIDE = 1600;

/**
 * The design step's whiteboard. The drawing is saved as a draft on this device while you work,
 * and exported to PNG on submit so the AI can look at it.
 */
const Whiteboard = forwardRef(({ draftKey, onCountChange }, ref) => {
    const apiRef = useRef(null);
    const saveTimer = useRef(null);
    const lastCount = useRef(-1);
    const initialData = useMemo(() => {
        const draft = readDraft(draftKey);
        return {
            elements: draft?.elements || [],
            // Dark mode inverts the canvas: a white background and default dark strokes show as a dark
            // board with light lines, and export as a readable black-on-white image.
            appState: { viewBackgroundColor: '#ffffff', currentItemRoughness: 1 },
            scrollToContent: true,
        };
    }, [draftKey]);

    useImperativeHandle(ref, () => ({
        async exportPng() {
            const api = apiRef.current;
            const elements = api?.getSceneElements().filter(e => !e.isDeleted) || [];
            if (!elements.length) return null;
            return exportToBlob({
                elements,
                files: api.getFiles(),
                mimeType: 'image/png',
                exportPadding: 24,
                appState: { ...api.getAppState(), exportBackground: true, exportWithDarkMode: false, viewBackgroundColor: '#ffffff' },
                getDimensions: (width, height) => {
                    const scale = Math.min(2, MAX_EXPORT_SIDE / Math.max(width, height));
                    return { width: width * scale, height: height * scale, scale };
                },
            });
        },
        clearDraft() { writeDraft(draftKey, null); },
    }), [draftKey]);

    const handleChange = (elements) => {
        const live = elements.filter(e => !e.isDeleted);
        if (live.length !== lastCount.current) {
            lastCount.current = live.length;
            onCountChange?.(live.length);
        }
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => writeDraft(draftKey, { elements: live }), 800);
    };

    return (
        <div className="vi-excalidraw">
            <Excalidraw
                excalidrawAPI={(api) => { apiRef.current = api; }}
                initialData={initialData}
                onChange={handleChange}
                theme="dark"
                UIOptions={UI_OPTIONS}
                name="System design"
            />
        </div>
    );
});

Whiteboard.displayName = 'Whiteboard';

export default Whiteboard;
