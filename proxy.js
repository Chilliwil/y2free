export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL' });

  const response = await fetch(decodeURIComponent(url), {
    headers: { 'referer': 'https://www.youtube.com' }
  });

  res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp4');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const buffer = await response.arrayBuffer();
  res.send(Buffer.from(buffer));
}
