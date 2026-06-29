// Safe JSON-LD serialisation for `<script type="application/ld+json" dangerouslySetInnerHTML>`.
//
// JSON.stringify does NOT escape `<`, `>`, `&`, or the JS line separators U+2028/U+2029. A string
// field that contains user- or third-party-controlled text (e.g. a Google review body) could include
// `</script><script>…` and break OUT of the JSON-LD <script> element — with CSP `unsafe-inline` still
// in place, the injected inline script would then execute on the app origin (stored XSS). Escaping
// these characters to their \uXXXX form keeps the JSON byte-identical to any parser while making the
// breakout impossible. Use `jsonLdHtml(obj)` as the `__html` value EVERYWHERE we inject JSON-LD.
//
// The pattern is built from a string (not a regex literal) so the U+2028/U+2029 escapes stay plain
// ASCII in source and can't be mangled into literal whitespace.
const UNSAFE = new RegExp("[<>&\\u2028\\u2029]", "g");

export function jsonLdHtml(obj: unknown): string {
  return JSON.stringify(obj).replace(
    UNSAFE,
    (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
  );
}
