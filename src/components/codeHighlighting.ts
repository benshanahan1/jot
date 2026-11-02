import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/**
 * Syntax colors for code blocks, read from CSS variables so they follow the light/dark theme.
 * Replaces Crepe's default One Dark theme, which is unreadable on a light background.
 */
const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.controlKeyword, t.tagName], color: 'var(--code-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp, t.url], color: 'var(--code-string)' },
  { tag: [t.number, t.bool, t.atom, t.null, t.constant(t.variableName)], color: 'var(--code-constant)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: 'var(--code-function)' },
  { tag: [t.typeName, t.className, t.namespace, t.attributeName], color: 'var(--code-type)' },
  { tag: [t.comment, t.meta, t.processingInstruction], color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: t.invalid, color: 'var(--code-invalid)' },
  { tag: t.heading, fontWeight: 'bold' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.link, textDecoration: 'underline' },
]);

export const codeHighlighting = syntaxHighlighting(highlightStyle);
