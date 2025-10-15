// === CONFIGURATION ===
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx55Q_UJIZAxrqLSvHqkdE10fXDFpVhLf4chgXL5u5vBbt_IG4CFcCVOeE_mclq7AFt/exec';
const SECRET = 'MY_SECRET_123';
const BUTTON_TEXT = 'To Sheets';

// === HELPERS ===
async function postToSheets(values, meta = {}) {
    const res = await fetch(WEB_APP_URL, {
        method: 'POST',
        headers: {
            // IMPORTANT: "simple" content-type to avoid preflight
            'Content-Type': 'text/plain;charset=UTF-8'
        },
        body: JSON.stringify({ secret: SECRET, values, meta })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Unknown error');
    return data;
}

// Insert buttons next to the item name
function injectButtons(root = document) {
    const links = root.querySelectorAll('a.market_listing_row_link');
    links.forEach(link => {
        if (link.dataset.rcInjected === '1') return;

        // Find block with the item name
        const nameBlock = link.querySelector('.market_listing_item_name_block');
        const nameEl = link.querySelector('.market_listing_item_name');
        if (!nameBlock || !nameEl) return;

        // Create button
        const btn = document.createElement('button');
        btn.className = 'rc-btn';
        btn.type = 'button';
        btn.textContent = BUTTON_TEXT;

        // Click handler (prevent navigation)
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const href = link.getAttribute('href');
            const titleEl = nameEl;
            const gameEl  = link.querySelector('.market_listing_game_name');

            btn.classList.remove('ok', 'err');
            btn.classList.add('sending');

            try {
                await postToSheets([href], {
                    pageUrl: location.href,
                    itemName: titleEl ? titleEl.textContent.trim() : null,
                    gameName: gameEl ? gameEl.textContent.trim() : null,
                    clickedAt: new Date().toISOString()
                });
                btn.classList.remove('sending');
                btn.classList.add('ok');
                btn.textContent = 'Done';
                // temporary removed - ok should be stay in ok-state
                // setTimeout(() => {
                //     btn.textContent = BUTTON_TEXT;
                //     btn.classList.remove('ok');
                // }, 1200);
            } catch (err) {
                console.error('Send failed:', err);
                btn.classList.remove('sending');
                btn.classList.add('err');
                btn.textContent = 'Error';
                setTimeout(() => {
                    btn.textContent = BUTTON_TEXT;
                    btn.classList.remove('err');
                }, 1500);
            }
        });

        // Place the button to the right of the item name
        nameBlock.style.display = 'flex';
        nameBlock.style.alignItems = 'center';
        nameBlock.style.gap = '8px';
        nameEl.after(btn);

        link.dataset.rcInjected = '1';
    });
}

// Initialize and observe dynamic content on Steam Market
function init() {
    injectButtons(document);

    const mo = new MutationObserver((mutations) => {
        for (const m of mutations) {
            m.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    injectButtons(node);
                }
            });
        }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
