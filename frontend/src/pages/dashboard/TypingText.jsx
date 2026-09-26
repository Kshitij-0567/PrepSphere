import React, { useEffect, useState } from 'react';

// Dynamic Typewriter Component for Smooth Text Presentation.
// Callers pass a `key` that changes with the text, so each new text starts from empty.
const TypingText = ({ text, speed = 14 }) => {
    const [displayed, setDisplayed] = useState('');

    useEffect(() => {
        if (!text) return undefined;
        let index = 0;
        const timer = setInterval(() => {
            index++;
            setDisplayed(text.slice(0, index));
            if (index >= text.length) {
                clearInterval(timer);
            }
        }, speed);
        return () => clearInterval(timer);
    }, [text, speed]);

    return (
        <span className="typing-text-wrapper">
            {displayed}
            {displayed.length < (text ? text.length : 0) && <span className="typing-cursor">▌</span>}
        </span>
    );
};

export default TypingText;
