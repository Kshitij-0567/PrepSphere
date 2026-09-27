import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { go } from '@codemirror/legacy-modes/mode/go';
import { verilog } from '@codemirror/legacy-modes/mode/verilog';
import { standardSQL } from '@codemirror/legacy-modes/mode/sql';

const LANGUAGES = {
    python: () => python(),
    javascript: () => javascript(),
    java: () => java(),
    cpp: () => cpp(),
    c: () => cpp(),
    go: () => StreamLanguage.define(go),
    verilog: () => StreamLanguage.define(verilog),
    sql: () => StreamLanguage.define(standardSQL),
};

const theme = EditorView.theme({
    '&': { backgroundColor: '#070d1c', color: '#cbd5e1', height: '100%', fontSize: '13px' },
    '.cm-scroller': { fontFamily: "'JetBrains Mono', ui-monospace, Consolas, monospace", lineHeight: '1.7' },
    '.cm-content': { caretColor: '#c7d2fe', padding: '12px 0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#c7d2fe' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(129,140,248,0.3) !important' },
    '.cm-gutters': { backgroundColor: '#070d1c', color: '#3d4866', border: 'none' },
    '.cm-activeLine': { backgroundColor: 'rgba(129,140,248,0.05)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#6f7b98' },
    '.cm-matchingBracket': { backgroundColor: 'rgba(129,140,248,0.2)', outline: 'none' },
    '&.cm-focused': { outline: 'none' },
}, { dark: true });

const highlight = syntaxHighlighting(HighlightStyle.define([
    { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.modifier], color: '#c4b5fd' },
    { tag: [t.string, t.special(t.string), t.regexp], color: '#86efac' },
    { tag: [t.number, t.bool, t.null, t.atom], color: '#fcd34d' },
    { tag: [t.comment, t.lineComment, t.blockComment], color: '#5b6788', fontStyle: 'italic' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#93c5fd' },
    { tag: [t.typeName, t.className, t.namespace], color: '#67e8f9' },
    { tag: [t.propertyName], color: '#e2e8f0' },
    { tag: [t.operator, t.punctuation], color: '#94a3b8' },
]));

const SETUP = { foldGutter: false, highlightActiveLineGutter: true, autocompletion: false, searchKeymap: false };

/** The coding step's editor. Escape then Tab moves focus out of the editor. */
const CodeEditor = ({ value, language, onChange, label }) => {
    const extensions = useMemo(() => [
        (LANGUAGES[language] || LANGUAGES.python)(), highlight, EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': label }),
    ], [language, label]);
    return (
        <CodeMirror
            value={value}
            onChange={onChange}
            theme={theme}
            extensions={extensions}
            basicSetup={SETUP}
            height="100%"
            className="vi-codemirror"
        />
    );
};

export default CodeEditor;
