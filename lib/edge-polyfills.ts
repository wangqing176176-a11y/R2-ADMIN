// Polyfills required when running AWS SDK v3 in Cloudflare Pages/Workers.
// In particular, S3 XML deserialization may rely on `DOMParser` which is not available by default.
import { DOMParser as XmldomDOMParser } from "@xmldom/xmldom";

const g = globalThis as unknown as { DOMParser?: unknown };
if (typeof g.DOMParser === "undefined") g.DOMParser = XmldomDOMParser;
