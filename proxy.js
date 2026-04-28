export const config = { api: { responseLimit: false } };

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL' });

  const response = await fetch(decodeURIComponent(url), {
    headers: {
      'referer': 'https://www.youtube.com',
      'user-agent': 'Mozilla/5.0'
    }
  });

  if (!response.ok) return res.status(response.status).json({ error: 'Error fetching video' });

  res.setHeader('Content-Type', response.headers.get('content-type') || 'video/mp4');
  res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { Readable } = require('stream');
  Readable.fromWeb(response.body).pipe(res);
}
