const puppeteer = require('puppeteer-core');

async function getTikTokFollowers(username, maxScrolls = 50) {
    const profileUrl = `https://www.tiktok.com/@${username}`;

    const browser = await puppeteer.launch({
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

    // 1️⃣ Ir al perfil
    await page.goto(profileUrl, { waitUntil: 'networkidle2' });

    // 2️⃣ Obtener número total de seguidores
    let followersCount = 0;
    try {
        await page.waitForSelector('[data-e2e="followers-count"]', { timeout: 10000 });
        followersCount = await page.$eval('[data-e2e="followers-count"]', el => el.textContent.trim());
        followersCount = parseInt(followersCount.replace(/,/g, ''), 10);
    } catch (err) {
        console.warn(`⚠ No se pudo obtener la cantidad de seguidores de @${username}`);
    }

    // 3️⃣ Click en el botón de "Seguidores"
    try {
        const followersContainer = await page.$('span[data-e2e="followers"]');
        if (followersContainer) {
            await page.evaluate(el => el.closest('div').click(), followersContainer);
            console.log("✅ Click en botón de seguidores");
        } else {
            throw new Error("No se encontró el botón de seguidores");
        }
    } catch (err) {
        console.error("❌ Error al abrir popup de seguidores:", err);
        await browser.close();
        return { count: followersCount, followers: [] };
    }

    // 4️⃣ Esperar popup y lista
    try {
        await page.waitForSelector('#tux-portal-container', { timeout: 10000 });
        await page.waitForSelector('#tux-portal-container [data-e2e="follow-info-popup"]', { timeout: 10000 });
        console.log("✅ Popup de seguidores detectado");
    } catch (err) {
        console.error("❌ No se encontró el popup de seguidores");
        await browser.close();
        return { count: followersCount, followers: [] };
    }

    // 5️⃣ Scroll dentro del contenedor real
    const followers = new Set();
    const listContainerSelector = '#tux-portal-container .css-wq5jjc-DivUserListContainer.ewp2ri60';

    for (let i = 0; i < maxScrolls; i++) {
        const newFollowers = await page.$$eval(
            `${listContainerSelector} p.css-3gbgjv-PUniqueId`,
            els => els.map(e => e.textContent.trim())
        );

        const prevCount = followers.size;
        newFollowers.forEach(f => followers.add(f));

        const didScroll = await page.evaluate(async (selector) => {
            const container = document.querySelector(selector);
            if (!container) return false;

            const initialCount = container.querySelectorAll('li').length;

            container.scrollTop = container.scrollHeight;

            const waitForNewItems = () => {
                return new Promise(resolve => {
                    let attempts = 0;
                    const maxAttempts = 10;

                    const interval = setInterval(() => {
                        const newCount = container.querySelectorAll('li').length;
                        if (newCount > initialCount) {
                            clearInterval(interval);
                            resolve(true);
                        } else if (attempts >= maxAttempts) {
                            clearInterval(interval);
                            resolve(false);
                        }
                        attempts++;
                    }, 300);
                });
            };

            return await waitForNewItems();
        }, listContainerSelector);



        if (!didScroll) {
            console.warn(`⚠ No se pudo hacer scroll en el intento ${i + 1}`);
            break;
        }

        // Si no hay nuevos usuarios, rompemos el bucle
        if (followers.size === prevCount) {
            console.log("ℹ No se encontraron más seguidores, deteniendo scroll");
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    await browser.close();

    return {
        count: followersCount,
        followers: Array.from(followers)
    };
}

module.exports = { getTikTokFollowers };
