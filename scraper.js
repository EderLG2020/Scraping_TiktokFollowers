const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

async function getTikTokFollowers(username, maxScrolls = 100) {
    const profileUrl = `https://www.tiktok.com/@${username}`;
    let browser;

    const startTime = Date.now();

    try {
        browser = await puppeteer.launch({
            headless: true,
            slowMo: 50,
            executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
            userDataDir: "C:\\Users\\Usuario\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data",
            args: [
                "--profile-directory=Default",
                "--no-sandbox",
                "--disable-setuid-sandbox"
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        console.log(`Scraping seguidores de: @${username}`);
        await page.goto(profileUrl, { waitUntil: 'networkidle2' });

        let followersCount = 0;
        try {
            await page.waitForSelector('[data-e2e="followers-count"]', { timeout: 10000 });
            const rawCount = await page.$eval('[data-e2e="followers-count"]', el => el.textContent.trim());
            followersCount = parseInt(rawCount.replace(/,/g, ''), 10);
        } catch {
            console.warn("⚠ No se pudo obtener el número total de seguidores.");
        }

        const followersButton = await page.$('span[data-e2e="followers"]');
        if (!followersButton) {
            console.error("❌ Botón de seguidores no encontrado.");
            return { count: followersCount, followers: [] };
        }

        await page.evaluate(el => el.closest('div').click(), followersButton);
        console.log("✅ Click en botón de seguidores");

        await page.waitForSelector('#tux-portal-container', { timeout: 10000 });
        await page.waitForSelector('[data-e2e="follow-info-popup"]', { timeout: 10000 });
        console.log("✅ Popup de seguidores detectado");

        const followers = new Set();
        const listContainerSelector = '#tux-portal-container .css-wq5jjc-DivUserListContainer.ewp2ri60';
        let scrollsPerformed = 0;

        const scrollDetails = [];

        for (let i = 0; i < maxScrolls; i++) {
            const scrollStart = Date.now();

            const newFollowers = await page.$$eval(
                `${listContainerSelector} p.css-3gbgjv-PUniqueId`,
                els => els.map(e => e.textContent.trim())
            );
            const prevCount = followers.size;
            newFollowers.forEach(f => followers.add(f));

            const moreItemsLoaded = await page.evaluate(async (selector) => {
                const container = document.querySelector(selector);
                if (!container) return false;

                const before = container.querySelectorAll('li').length;
                container.scrollTop = container.scrollHeight;

                return await new Promise(resolve => {
                    let tries = 0;
                    const interval = setInterval(() => {
                        const after = container.querySelectorAll('li').length;
                        if (after > before) {
                            clearInterval(interval);
                            resolve(true);
                        }
                        if (++tries > 10) {
                            clearInterval(interval);
                            resolve(false);
                        }
                    }, 300);
                });
            }, listContainerSelector);

            if (!moreItemsLoaded) {
                console.log(`ℹ Scroll detenido en intento ${i + 1}: no se cargaron más elementos.`);
                break;
            }

            scrollsPerformed++;
            const scrollEnd = Date.now();
            const scrollDuration = ((scrollEnd - scrollStart) / 1000).toFixed(2);

            scrollDetails.push({
                duration_seconds: parseFloat(scrollDuration)
            });

            console.log(` Scroll #${scrollsPerformed} realizado en ${scrollDuration} segundos`);

            if (followers.size === prevCount) {
                console.log("ℹ No se encontraron más seguidores nuevos.");
                break;
            }

            await new Promise(res => setTimeout(res, 1200));
        }

        const endTime = Date.now();
        const totalTimeSeconds = Math.round((endTime - startTime) / 1000);

        const result = {
            username,
            detected_followers: followers.size,
            reported_count: followersCount,
            scrolls: scrollsPerformed,
            duration_seconds: totalTimeSeconds,
            scroll_details: scrollDetails,  // <-- Aquí incluimos el detalle de cada scroll
            followers: Array.from(followers)
        };

        const filename = `${username}-${new Date().toISOString().split("T")[0]}.json`;
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(result, null, 2));
        console.log(`✅ Archivo guardado en carpeta data`);

        return result;

    } catch (err) {
        console.error("❌ Error durante la ejecución:", err);
        return { count: 0, followers: [] };
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { getTikTokFollowers };
