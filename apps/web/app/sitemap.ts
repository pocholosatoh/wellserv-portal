// Generates https://www.wellserv.co/sitemap.xml
export default async function sitemap() {
  const base = "https://www.wellserv.co";

  // If you have dynamic URLs, fetch them here (e.g. from Supabase) and map them.
  // const items = await fetchData();
  // const dynamic = items.map(x => ({ url: `${base}/patients/${x.id}`, lastModified: x.updated_at }));

  return [
    { url: `${base}/`, lastModified: new Date() },
    { url: `${base}/doctor`, lastModified: new Date() },
    { url: `${base}/staff`, lastModified: new Date() },
    //{ url: `${base}/patient`,       lastModified: new Date() },
    // ...spread dynamic entries here
  ];
}
