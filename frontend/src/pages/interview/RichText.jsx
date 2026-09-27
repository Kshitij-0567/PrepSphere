import React from 'react';

/** Plain text where `backticks` mark inline code, as AI-written problems often use. */
const RichText = ({ text }) => (text || '').split(/(`[^`\n]+`)/).map((part, i) => (
    part.startsWith('`') && part.endsWith('`') && part.length > 2
        ? <code key={i}>{part.slice(1, -1)}</code>
        : <React.Fragment key={i}>{part}</React.Fragment>
));

export default RichText;
