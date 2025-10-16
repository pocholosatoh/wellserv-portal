// Generates https://www.wellserv.co/robots.txt
export default function robots() {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      // Example: disallow private app paths
      { userAgent: "*", disallow: ["/staff", "/doctor", "/api"] },
    ],
    sitemap: "https://www.wellserv.co/sitemap.xml",
    host: "https://www.wellserv.co",
  };
}
