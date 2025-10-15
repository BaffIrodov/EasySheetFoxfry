// === CONFIGURATION ===
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbybOa_apP4MHNCIGinJT_8dwbj_gRPBOuR2CMM_V-ANz4qDtq2PbE-eyorAxtAfAapk/exec';
const SECRET = 'MY_SECRET_123';
const BUTTON_TEXT = 'Foxfry';

// === API ===
async function postToSheets(values, meta = {}) {
    const res = await fetch(WEB_APP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=UTF-8'
        },
        body: JSON.stringify({ secret: SECRET, values, meta })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Unknown error');
    return data; // { ok: true, message: "Added" | "Already in sheet" }
}

// === UI HELPERS ===
function applyResultToButton(btn, message) {
    btn.classList.remove('sending', 'err');
    btn.classList.add('ok');

    if (message === 'Added') {
        btn.textContent = 'Добавлено';
    } else if (message === 'Already in sheet') {
        btn.textContent = 'Уже добавлено';
    } else {
        btn.textContent = 'Готово';
    }

    btn.disabled = true;
    btn.style.pointerEvents = 'none';
}

function applyErrorToButton(btn, label = 'Ошибка') {
    btn.classList.remove('sending', 'ok');
    btn.classList.add('err');
    btn.textContent = label;

    setTimeout(() => {
        btn.classList.remove('err');
        btn.textContent = BUTTON_TEXT;
        btn.disabled = false;
        btn.style.pointerEvents = '';
    }, 10000);
}

// === CORE INJECTION ===
function injectButtons(root = document) {
    const links = root.querySelectorAll('a.market_listing_row_link');
    links.forEach(link => {
        if (link.dataset.rcInjected === '1') return;

        const nameBlock = link.querySelector('.market_listing_item_name_block');
        const nameEl = link.querySelector('.market_listing_item_name');
        if (!nameBlock || !nameEl) return;

        // Создаём кнопку
        const btn = document.createElement('button');
        btn.className = 'rc-btn';
        btn.type = 'button';
        btn.textContent = BUTTON_TEXT;

        // Обработчик клика
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const href = link.getAttribute('href');
            const titleEl = nameEl;
            const gameEl  = link.querySelector('.market_listing_game_name');

            btn.classList.remove('ok', 'err');
            btn.classList.add('sending');

            try {
                const data = await postToSheets([href], {
                    pageUrl: location.href,
                    itemName: titleEl ? titleEl.textContent.trim() : null,
                    gameName: gameEl ? gameEl.textContent.trim() : null,
                    clickedAt: new Date().toISOString()
                });

                applyResultToButton(btn, data.message);
            } catch (err) {
                console.error('Send failed:', err);
                if (String(err.message || '').toLowerCase().includes('unauthorized')) {
                    applyErrorToButton(btn, 'Нет доступа');
                } else {
                    applyErrorToButton(btn, 'Ошибка');
                }
            }
        });

        // Ставим кнопку справа от названия
        nameBlock.style.display = 'flex';
        nameBlock.style.alignItems = 'center';
        nameBlock.style.gap = '8px';
        nameEl.after(btn);

        link.dataset.rcInjected = '1';
    });
}

// === RESCANNERS & HOOKS ===
let observerStarted = false;
let intervalId = null;
let lastUrl = location.href;

function startMutationObserver() {
    if (observerStarted) return;
    observerStarted = true;

    const mo = new MutationObserver((mutations) => {
        // Быстрая проверка: если появились новые элементы — инжектим
        let shouldScan = false;
        for (const m of mutations) {
            if (m.addedNodes && m.addedNodes.length) { shouldScan = true; break; }
        }
        if (shouldScan) {
            // Мелкая дебаунс-защита
            queueMicrotask(() => injectButtons(document));
        }
    });

    mo.observe(document.documentElement, { childList: true, subtree: true });
}

function startSafetyInterval() {
    if (intervalId) return;
    // Раз в 1000 мс пробегаемся по DOM (дешёвая операция: только query + метка dataset)
    intervalId = setInterval(() => {
        injectButtons(document);
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            // При смене URL многие сайты перерисовывают таблицу
            injectButtons(document);
        }
    }, 1000);
}

function hookSpaNavigation() {
    // Патчим pushState/replaceState, чтобы реагировать на SPA-навигацию
    const wrap = (fnName) => {
        const orig = history[fnName];
        if (typeof orig !== 'function') return;
        history[fnName] = function (...args) {
            const ret = orig.apply(this, args);
            // Небольшая задержка — даём DOM обновиться
            setTimeout(() => {
                if (location.href !== lastUrl) {
                    lastUrl = location.href;
                    injectButtons(document);
                }
            }, 50);
            return ret;
        };
    };
    wrap('pushState');
    wrap('replaceState');

    window.addEventListener('popstate', () => {
        setTimeout(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                injectButtons(document);
            }
        }, 50);
    });

    // Возврат из bfcache
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
            setTimeout(() => injectButtons(document), 50);
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            setTimeout(() => injectButtons(document), 50);
        }
    });
}

// === BOOT ===
function init() {
    injectButtons(document);
    startMutationObserver();
    startSafetyInterval();
    hookSpaNavigation();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}