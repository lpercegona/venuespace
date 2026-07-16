import sanitizeHtml from "sanitize-html";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "p", "br", "hr",
    "strong", "em", "u", "s", "code", "pre", "blockquote",
    "ul", "ol", "li",
    "a", "img",
    "span", "div",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    span: ["class"],
    div: ["class"],
    code: ["class"],
    pre: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
};

export function sanitizeBlogHtml(html: string): string {
  return sanitizeHtml(html ?? "", OPTIONS);
}

export function htmlToText(html: string): string {
  return sanitizeHtml(html ?? "", { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}
