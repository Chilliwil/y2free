const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  next();
});

app.use(express.static('.'));

app.get('/api/proxy', async (req, res) => {
  const { id, quality, type } = req.query;
  if (!id) return res.status(400).json({ error: 'No video ID' });

  try {
    const apiRes = await fetch(
      `https://ytstream-download-youtube-videos.p.rapidapi.com/dl?id=${id}`,
      {
        headers: {
          'x-rapidapi-key': process.env.RAPIDAPI_KEY,
          'x-rapidapi-host': 'ytstream-download-youtube-videos.p.rapidapi.com'
        }
      }
    );
    const data = await apiRes.json();
    if (data.status !== 'OK') return res.status(500).json({ error: 'API error', detail: data });

    const allFormats = [...(data.formats || []), ...(data.adaptiveFormats || [])];

    let target;
    if (type === 'audio') {
      target = allFormats.find(f => f.mimeType?.includes('audio/mp4') && f.url)
            || allFormats.find(f => f.mimeType?.includes('audio') && f.url);
    } else {
      target = allFormats.find(f => f.mimeType?.includes('video/mp4') && f.qualityLabel?.includes(quality || '360') && f.url)
            || allFormats.find(f => f.mimeType?.includes('video/mp4') && f.url);
    }

    if (!target?.url) return res.status(404).json({ error: 'No format found' });

    const upstreamHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com',
      'Range': req.headers.range || 'bytes=0-'
    };

    const mediaRes = await fetch(target.url, { headers: upstreamHeaders });

    if (!mediaRes.ok && mediaRes.status !== 206) {
      const errBody = await mediaRes.text().catch(() => '');
      console.error('Googlevideo rejected:', mediaRes.status, errBody.slice(0, 200));
      return res.status(502).json({ 
        error: 'Upstream rejected', 
        status: mediaRes.status
      });
    }

    const filename = type === 'audio' ? 'audio.mp3' : 'video.mp4';
    const contentType = type === 'audio' ? 'audio/mpeg' : 'video/mp4';

    res.status(mediaRes.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    
    const cl = mediaRes.headers.get('content-length');
    const cr = mediaRes.headers.get('content-range');
    if (cl) res.setHeader('Content-Length', cl);
    if (cr) res.setHeader('Content-Range', cr);

    mediaRes.body.on('error', (e) => {
      console.error('Stream error:', e.message);
      if (!res.writableEnded) res.end();
    });
    
    mediaRes.body.pipe(res);

  } catch (err) {
    console.error('Server error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
