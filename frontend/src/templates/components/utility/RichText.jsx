import React from 'react';

/**
 * Renders prose that carries paragraph structure.
 *
 * Content polished on the backend separates paragraphs with a blank line, but
 * HTML collapses whitespace, so `<p>{text}</p>` flattened a multi-paragraph day
 * description back into one wall of text. This splits on blank lines and emits a
 * real paragraph per block, and turns "- " lines into a list.
 *
 * `as` keeps the caller's element for single-paragraph text so existing spacing
 * and typography are unchanged when there is nothing to split.
 */
export default function RichText({
  text,
  fallback = '',
  className = '',
  style = {},
  as: Tag = 'p',
  paragraphSpacing = '0.75em',
}) {
  const raw = typeof text === 'string' ? text : (text == null ? '' : String(text));
  const content = raw.trim() || fallback;

  if (!content) return null;

  const blocks = content.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  if (blocks.length <= 1 && !/^\s*[-*]\s+/m.test(content)) {
    return <Tag className={className} style={style}>{content}</Tag>;
  }

  return (
    <div className={className} style={style}>
      {blocks.map((block, i) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        const isList = lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l));

        if (isList) {
          return (
            <ul
              key={i}
              style={{
                margin: i === 0 ? `0 0 ${paragraphSpacing}` : `0 0 ${paragraphSpacing}`,
                paddingLeft: '1.25em',
                listStyleType: 'disc',
              }}
            >
              {lines.map((l, j) => (
                <li key={j} style={{ marginBottom: '0.25em' }}>{l.replace(/^[-*]\s+/, '')}</li>
              ))}
            </ul>
          );
        }

        return (
          <p
            key={i}
            style={{
              margin: 0,
              marginBottom: i === blocks.length - 1 ? 0 : paragraphSpacing,
            }}
          >
            {block.split('\n').map((line, j, arr) => (
              <React.Fragment key={j}>
                {line}
                {j < arr.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
