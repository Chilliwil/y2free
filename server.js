const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

app.use(express.static('.'));

app.get('/api/proxy', async (req, res) => {
  const { id, quality } = req.query;
  if (!id) return res.status(400).json({ error: 'No video ID' });

  try {
    const apiRes = await fetch(
      `https://ytstream-download-youtube-videos.p.rapidapi.com/dl?id=${id}`,
      { headers: {
        'x-rapidapi-key': '144a34d176mshf9fb36e0ea0618ap1211e4jsn83a547d354c7',
        'x-rapidapi-host': 'ytstream-download-youtube-videos.p.rapidapi.com'
      }}
    );
    const data = await apiRes.json();
    if (data.status !== 'OK') return res.status(500).json({ error: 'API error' });

    const allFormats = [...(data.formats||[]), ...(data.adaptiveFormats||[])];
    const target = allFormats.find(f => f.mimeType?.includes('video/mp4') && f.qualityLabel?.includes(quality||'720'))
                || allFormats.find(f => f.mimeType?.includes('video/mp4') && f.url);

    if (!target?.url) return res.status(404).json({ error: 'No format found' });

    const videoRes = await fetch(target.url, {
      headers: { 'referer': 'https://www.youtube.com', 'user-agent': 'Mozilla/5.0' }
    });

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${data.title||'video'}.mp4"`);
    videoRes.body.pipe(res);

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000);
