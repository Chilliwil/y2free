const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use(express.static('.'));

const RAPIDAPI_HOST = 'youtube-to-mp315.p.rapidapi.com';
const RAPIDAPI_HEADERS = {
  'x-rapidapi-key': process.env.RAPIDAPI_KEY,
  'x-rapidapi-host': RAPIDAPI_HOST
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

app.get('/api/proxy', async (req, res) => {
  const { id, type, quality } = req.query;
  if (!id) return res.status(400).json({ error: 'No video ID' });

  try {
    // PASO 1: Iniciar conversión (POST con query params, no body)
    const youtubeUrl = `https://www.youtube.com/watch?v=${id}`;
    const format = type === 'video' ? 'MP4' : 'MP3';
    
    const downloadEndpoint = `https://${RAPIDAPI_HOST}/conversis/api/download?url=${encodeURIComponent(youtubeUrl)}&format=${format}&quality=0`;
    
    const downloadRes = await fetch(downloadEndpoint, {
      method: 'POST',
      headers: RAPIDAPI_HEADERS
    });
    
    const downloadData = await downloadRes.json();
    if (!downloadData.id) {
      return res.status(500).json({ error: 'Failed to start conversion', detail: downloadData });
    }

    const conversionId = downloadData.id;

    // PASO 2: Polling al status
    let statusData = null;
    const maxAttempts = 30;
    
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(2000);
      
      const statusRes = await fetch(
        `https://${RAPIDAPI_HOST}/conversis/api/status/${conversionId}`,
        { headers: RAPIDAPI_HEADERS }
      );
      statusData = await statusRes.json();
      
      console.log(`Poll ${i+1}: status=${statusData.status}`);
      
      if (statusData.status === 'DONE') break;
      if (statusData.status === 'FAILED' || statusData.status === 'ERROR') {
        return res.status(500).json({ error: 'Conversion failed', detail: statusData });
      }
    }

    if (statusData?.status !== 'DONE') {
      return res.status(504).json({ error: 'Conversion timeout', detail: statusData });
    }

    return res.json({
      downloadUrl: statusData.downloadUrl,
      title: statusData.title || 'audio',
      format: statusData.format || (type === 'video' ? 'MP4' : 'MP3')
    });

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
