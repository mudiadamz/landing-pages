/**
 * Parse HTML content into HTML, CSS, and JS parts.
 * Extracts <style> and <script> tags; the rest is HTML.
 */
export function parseHtmlContent(html: string): {
  html: string;
  css: string;
  js: string;
} {
  let htmlPart = html;
  let cssPart = "";
  let jsPart = "";

  // Extract <style>...</style>
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (styleMatch) {
    cssPart = styleMatch[1].trim();
    htmlPart = htmlPart.replace(styleMatch[0], "");
  }

  // Extract <script>...</script> (non-greedy, first match)
  const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
  if (scriptMatch) {
    jsPart = scriptMatch[1].trim();
    htmlPart = htmlPart.replace(scriptMatch[0], "");
  }

  return {
    html: htmlPart.trim(),
    css: cssPart,
    js: jsPart,
  };
}

/**
 * Merge HTML, CSS, and JS into a single HTML document.
 * Injects <style> before </head> if present, else before </body>, else at end.
 * Injects <script> before </body> if present, else at end.
 */
export function mergeHtmlContent(
  html: string,
  css: string,
  js: string
): string {
  let result = html;

  if (css) {
    const styleTag = `\n<style>\n${css}\n</style>\n`;
    if (result.includes("</head>")) {
      result = result.replace("</head>", `${styleTag}</head>`);
    } else if (result.includes("</body>")) {
      result = result.replace("</body>", `${styleTag}</body>`);
    } else {
      result += styleTag;
    }
  }

  if (js) {
    const scriptTag = `\n<script>\n${js}\n</script>\n`;
    if (result.includes("</body>")) {
      result = result.replace("</body>", `${scriptTag}</body>`);
    } else {
      result += scriptTag;
    }
  }

  return result;
}
