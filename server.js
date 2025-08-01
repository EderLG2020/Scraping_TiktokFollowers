const express = require('express');
const { getTikTokFollowers } = require('./scraper');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Cola en memoria para usuarios en proceso
let processingQueue = new Set();

// Carpeta para guardar resultados
const dataFolder = path.join(__dirname, 'data');
if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder);
}

app.get('/followers/:username', async (req, res) => {
    const { username } = req.params;
    const maxScrolls = parseInt(req.query.scrolls) || 30;

    if (processingQueue.has(username)) {
        return res.json({
            status: 'processing',
            message: `El usuario "${username}" ya está en cola, intenta con otro.`
        });
    }

    processingQueue.add(username);
    res.json({
        status: 'queued',
        message: `El usuario "${username}" está en proceso, espera a que termine.`
    });

    try {
        const followers = await getTikTokFollowers(username, maxScrolls);

        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `${username}-${dateStr}.json`;
        const filePath = path.join(dataFolder, fileName);

        fs.writeFileSync(filePath, JSON.stringify({
            username,
            total: followers.length,
            followers
        }, null, 2));

        console.log(`✅ Archivo guardado: ${fileName}`);
    } catch (err) {
        console.error(`❌ Error procesando ${username}:`, err);
    } finally {
        processingQueue.delete(username);
    }
});



app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// const puppeteer = require('puppeteer-core');

// (async () => {
//     const browser = await puppeteer.launch({
//         headless: false,
//         slowMo: 50,
//         executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
//         userDataDir: "C:\\Users\\Usuario\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data",
//         args: [
//             "--profile-directory=Default",
//             "--no-sandbox",
//             "--disable-setuid-sandbox"
//         ]
//     });

//     const page = await browser.newPage();
//     await page.goto('https://www.google.com', { waitUntil: 'networkidle2' });
//     console.log("✅ Brave abierto con perfil cargado");
// })();
