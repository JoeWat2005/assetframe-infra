import { describe, it, expect } from "vitest";
import { jsonLdHtml } from "@/lib/jsonld";

// U+2028/U+2029 built from char codes so the literal separators can't be mangled in source.
const U2028 = String.fromCharCode(0x2028);
const U2029 = String.fromCharCode(0x2029);

describe("jsonLdHtml — JSON-LD XSS escaping", () => {
  it("neutralises a </script> breakout in third-party text", () => {
    const out = jsonLdHtml({ reviewBody: "</script><script>alert(1)</script>" });
    expect(out).not.toMatch(/[<>]/); // no raw angle brackets -> cannot break out of the <script> element
    expect(out).toContain("\\u003c");
    expect(out).toContain("\\u003e");
    // a parser still sees the ORIGINAL text (escaping is transparent to JSON consumers)
    expect(JSON.parse(out).reviewBody).toBe("</script><script>alert(1)</script>");
  });

  it("escapes & and the JS line separators U+2028/U+2029", () => {
    const raw = "a & b" + U2028 + "c" + U2029 + "d";
    const out = jsonLdHtml({ s: raw });
    expect(out).not.toContain("&");
    expect(out).toContain("\\u0026");
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
    expect(JSON.parse(out).s).toBe(raw);
  });

  it("is parser-identical to the original object for safe content", () => {
    const obj = { "@context": "https://schema.org", "@type": "Organization", name: "AssetFrame", price: 19.99 };
    expect(JSON.parse(jsonLdHtml(obj))).toEqual(obj);
  });
});
