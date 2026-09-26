import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FeedbackContext } from './feedbackContext';

const FeedbackProvider = ({ children }) => {
    const [toastState, setToastState] = useState(null);
    const [tip, setTip] = useState(null);
    const tipRef = useRef(null);
    const timer = useRef(null);

    const toast = useCallback((text, options = {}) => {
        setToastState({ text, error: Boolean(options.error) });
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setToastState(null), options.duration || 3800);
    }, []);
    const showTip = useCallback((content, x, y) => setTip({ content, x, y }), []);
    const tipAt = useCallback((element, content) => {
        const box = element.getBoundingClientRect();
        setTip({ content, x: box.left + box.width / 2 - 14, y: box.bottom - 6 });
    }, []);
    const hideTip = useCallback(() => setTip(null), []);

    useEffect(() => () => clearTimeout(timer.current), []);

    // Keep the tooltip inside the viewport once its size is known.
    useLayoutEffect(() => {
        const el = tipRef.current;
        if (!tip || !el) return;
        const r = el.getBoundingClientRect();
        let left = tip.x + 14;
        let top = tip.y + 14;
        if (left + r.width > window.innerWidth - 8) left = tip.x - r.width - 14;
        if (top + r.height > window.innerHeight - 8) top = tip.y - r.height - 14;
        el.style.left = `${Math.max(8, left)}px`;
        el.style.top = `${Math.max(8, top)}px`;
    }, [tip]);

    const value = useMemo(() => ({ toast, showTip, tipAt, hideTip }), [toast, showTip, tipAt, hideTip]);

    return (
        <FeedbackContext.Provider value={value}>
            {children}
            {tip && (
                <div ref={tipRef} className="ps-tip" role="tooltip" style={{ left: -9999, top: -9999 }}>
                    {tip.content}
                </div>
            )}
            {toastState && (
                <div className={`ps-toast ${toastState.error ? 'is-error' : ''}`} role="status">{toastState.text}</div>
            )}
        </FeedbackContext.Provider>
    );
};

export default FeedbackProvider;
