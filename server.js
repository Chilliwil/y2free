const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use(express.static('.'));

app.get('/api/proxy', async (req, res) => {
  const { id, quality, type } = req.query;
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
    
    let target;
    if(type === 'audio'){
      // Buscar formato de solo audio
      target = allFormats.find(f => f.mimeType?.includes('audio/mp4') && f.url)
            || allFormats.find(f => f.mimeType?.includes('audio') && f.url);
    } else {
      // Buscar video MP4 con la calidad pedida
      target = allFormats.find(f => f.mimeType?.includes('video/mp4') && f.qualityLabel?.includes(quality||'360'))
            || allFormats.find(f => f.mimeType?.includes('video/mp4') && f.url);
    }

    if (!target?.url) return res.status(404).json({ error: 'No format found' });

    res.json({ url: target.url, title: data.title || 'Descarga' });

  } catch(err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
