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
  'x-rapidapi-host': RAPIDAPI_HOST,
  'Content-Type': 'application/json'
};

// Helper: esperar X milisegundos
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

app.get('/api/proxy', async (req, res) => {
  const { id, type } = req.query;
  if (!id) return res.status(400).json({ error: 'No video ID' });

  try {
    // PASO 1: Iniciar conversión
    const downloadRes = await fetch(
      `https://${RAPIDAPI_HOST}/download`,
      {
        method: 'POST',
        headers: RAPIDAPI_HEADERS,
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${id}`,
          format: type === 'video' ? 'MP4' : 'MP3',
          quality: 0
        })
      }
    );
    
    const downloadData = await downloadRes.json();
    if (!downloadData.id) {
      return res.status(500).json({ error: 'Failed to start conversion', detail: downloadData });
    }

    const conversionId = downloadData.id;

    // PASO 2: Hacer polling al status hasta que esté DONE
    let statusData = null;
    const maxAttempts = 30; // 30 intentos × 2s = 60s máximo
    
    for (let i = 0; i < maxAttempts; i++) {
      await sleep(2000); // esperar 2 segundos entre intentos
      
      const statusRes = await fetch(
        `https://${RAPIDAPI_HOST}/status/${conversionId}`,
        { headers: RAPIDAPI_HEADERS }
      );
      statusData = await statusRes.json();
      
      if (statusData.status === 'DONE') break;
      if (statusData.status === 'FAILED' || statusData.status === 'ERROR') {
        return res.status(500).json({ error: 'Conversion failed', detail: statusData });
      }
    }

    if (statusData?.status !== 'DONE') {
      return res.status(504).json({ error: 'Conversion timeout' });
    }

    // PASO 3: Devolver la URL de descarga al frontend
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
