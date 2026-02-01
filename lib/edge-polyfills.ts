// Polyfills required when running AWS SDK v3 in Cloudflare Pages/Workers.
// S3 XML deserialization may rely on `DOMParser` which is not available by default.
import { DOMParser as XmldomDOMParser } from "@xmldom/xmldom";

export const ensureDomParser = () => {
  const g = globalThis as unknown as { DOMParser?: unknown };
  if (typeof g.DOMParser === "undefined") g.DOMParser = XmldomDOMParser;
};
