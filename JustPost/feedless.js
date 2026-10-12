// Injected into every x.com page at document start.
// On /home the timeline is hidden and replaced by a quiet "write a post" card.
// A deliberately slow "peek" flow can show 1–5 posts for a few minutes.
// Sending a post or reply shows a small "posted ✓" banner with a link to it.
// Ads are hidden everywhere. The explore tab opens a plain search box instead of
// trending, and explore routes bounce home. Everything else (composer,
// notifications, DMs, grok, profiles, search) is untouched.
// X changes its markup often — if the feed leaks back, the selectors in `css` are what to fix.
(() => {
  if (window.__justPost || !/(^|\.)(x|twitter)\.com$/.test(location.hostname)) return;
  window.__justPost = true;

  const PEEK_MINUTES = 3;
  const COOLDOWN_MINUTES = 15;
  const WAIT_SECONDS = 20;
  const PHRASE = "i'm choosing to look at the feed on purpose";

  const BLOCKED = [/^\/explore(\/|$)/, /^\/i\/trends/, /^\/i\/connect_people/];

  const css = `
    html.jp-home:not(.jp-peek) [data-testid="primaryColumn"] section[role="region"],
    html.jp-home:not(.jp-peek) [data-testid="primaryColumn"] svg[aria-label="Pull to refresh"],
    html.jp-home [data-testid="TopNavBar"],
    [data-jp-ad],
    html.jp-home.jp-peek [data-testid="primaryColumn"] section[role="region"] [data-testid="cellInnerDiv"]:not([data-jp-ok]),
    [data-testid="sidebarColumn"] {
      display: none !important;
    }
    /* Kept apart from the list above: ios before 15.4 doesn't know :has() and would
       throw away the whole rule it appears in. */
    html.jp-home div:has(> [data-testid="TopNavBar"]) { display: none !important; }

    /* While peeking: clip the (virtualized) timeline right below the allowed posts,
       which also hides X's infinite-scroll loader so it stops fetching more. */
    [data-jp-clip] {
      height: var(--jp-h) !important;
      min-height: var(--jp-h) !important;
      max-height: var(--jp-h) !important;
      overflow: hidden !important;
    }

    #jp-card { display: none; }
    html.jp-card:not(.jp-peek) #jp-card {
      display: flex;
      position: fixed;
      inset: 0;
      z-index: 1;
      pointer-events: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0 32px;
      text-align: center;
      font: 16px/1.4 -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #jp-card > div, .jp-end {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      pointer-events: auto;
      width: 100%;
      max-width: 340px;
    }
    .jp-title { font-size: 22px; font-weight: 700; }
    .jp-line { opacity: 0.6; }
    .jp-post, .jp-btn {
      -webkit-appearance: none;
      border: 0;
      font: inherit;
      cursor: pointer;
    }
    .jp-post {
      margin-top: 24px;
      padding: 12px 28px;
      border-radius: 999px;
      background: rgb(29, 155, 240);
      color: #fff;
      font-weight: 700;
    }
    .jp-btn {
      padding: 8px 16px;
      border-radius: 999px;
      background: transparent;
      color: inherit;
      border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
    }
    .jp-btn:disabled { opacity: 0.3; }
    .jp-faint {
      -webkit-appearance: none;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      font-size: 13px;
      opacity: 0.35;
      margin-top: 18px;
      padding: 8px;
    }
    .jp-row { display: flex; gap: 10px; margin: 14px 0 4px; }
    .jp-row .jp-btn { width: 44px; height: 44px; padding: 0; }
    .jp-phrase { font-style: italic; margin: 10px 0 4px; }
    .jp-input {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
      background: transparent;
      color: inherit;
      font: 16px -apple-system, sans-serif;
      margin-bottom: 10px;
    }
    .jp-count { font-size: 56px; font-weight: 200; margin: 8px 0; font-variant-numeric: tabular-nums; }
    #jp-search {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: max(env(safe-area-inset-top), 20px) 16px 16px;
      font: 16px/1.4 -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #jp-search form { display: flex; gap: 10px; align-items: center; }
    #jp-search .jp-input { margin: 0; border-radius: 999px; padding: 10px 16px; }
    #jp-search .jp-faint { margin: 0; opacity: 0.7; font-size: 15px; white-space: nowrap; }
    #jp-toast {
      position: fixed;
      top: max(env(safe-area-inset-top), 12px);
      left: 50%;
      transform: translate(-50%, -150%);
      z-index: 2147483647;
      display: flex;
      gap: 14px;
      align-items: center;
      padding: 10px 18px;
      border-radius: 999px;
      background: rgb(29, 155, 240);
      color: #fff;
      font: 600 15px/1.2 -apple-system, BlinkMacSystemFont, sans-serif;
      white-space: nowrap;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
      transition: transform 0.3s ease;
    }
    #jp-toast.jp-show { transform: translate(-50%, 0); }
    #jp-toast.jp-bad { background: rgb(244, 33, 46); }
    #jp-toast a { color: #fff; opacity: 0.85; text-decoration: underline; font-weight: 400; }
    .jp-end {
      margin: 32px auto 80px;
      text-align: center;
      font: 16px/1.4 -apple-system, BlinkMacSystemFont, sans-serif;
    }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.documentElement.append(style);

  // --- small helpers -------------------------------------------------------

  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem('jp:' + key)); } catch { return null; } },
    set(key, value) { try { localStorage.setItem('jp:' + key, JSON.stringify(value)); } catch {} },
  };

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (k === 'class') node.className = v;
      else node[k] = v;
    }
    node.append(...children);
    return node;
  }

  // Use X's own links when they exist so navigation stays in the single-page app.
  function go(path) {
    const link = document.querySelector(`a[href="${path}"]`);
    if (link) link.click();
    else location.href = path;
  }

  function isHome(path) {
    return path === '/home' || path === '/';
  }

  // --- the card and the peek hoops ------------------------------------------

  const card = el('div', { id: 'jp-card' });
  let timer = null;

  function show(...children) {
    clearInterval(timer);
    card.replaceChildren(el('div', {}, ...children));
  }

  function idle() {
    const cooldownLeft = Math.ceil(((store.get('lastPeekEnd') || 0) + COOLDOWN_MINUTES * 60e3 - Date.now()) / 60e3);
    show(
      el('div', { class: 'jp-title', textContent: 'no feed here.' }),
      el('button', { class: 'jp-post', textContent: 'write a post', onclick: () => go('/compose/post') }),
      cooldownLeft > 0
        ? el('div', { class: 'jp-faint', textContent: `next peek in ${cooldownLeft} min` })
        : el('button', { class: 'jp-faint', textContent: 'peek at a few posts', onclick: askCount }),
    );
    if (cooldownLeft > 0) timer = setInterval(idle, 60e3);
  }

  function askCount() {
    show(
      el('div', { class: 'jp-title', textContent: 'how many?' }),
      el('div', { class: 'jp-row' },
        ...[1, 2, 3, 4, 5].map((n) => el('button', { class: 'jp-btn', textContent: String(n), onclick: () => askPhrase(n) }))),
      el('button', { class: 'jp-faint', textContent: 'never mind', onclick: idle }),
    );
  }

  function askPhrase(n) {
    const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' ]/g, '').replace(/\s+/g, ' ').trim();
    const next = el('button', { class: 'jp-btn', textContent: 'continue', disabled: true, onclick: () => wait(n) });
    const input = el('input', {
      class: 'jp-input',
      placeholder: 'type it out',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: false,
      oninput: () => { next.disabled = norm(input.value) !== norm(PHRASE); },
      onpaste: (e) => e.preventDefault(),
    });
    show(
      el('div', { class: 'jp-line', textContent: 'type this, no pasting:' }),
      el('div', { class: 'jp-phrase', textContent: PHRASE }),
      input,
      next,
      el('button', { class: 'jp-faint', textContent: 'never mind', onclick: idle }),
    );
    input.focus();
  }

  function wait(n) {
    document.activeElement?.blur();
    let left = WAIT_SECONDS;
    const count = el('div', { class: 'jp-count', textContent: String(left) });
    const line = el('div', { class: 'jp-line', textContent: 'breathe for a bit. still want to?' });
    const slot = el('div');
    show(count, line, slot, el('button', { class: 'jp-faint', textContent: 'never mind', onclick: idle }));
    timer = setInterval(() => {
      left -= 1;
      count.textContent = String(Math.max(left, 0));
      if (left > 0) return;
      clearInterval(timer);
      slot.replaceWith(el('button', {
        class: 'jp-btn',
        textContent: `ok, show me ${n}`,
        onclick: () => startPeek(n),
      }));
    }, 1000);
  }

  // --- peeking -------------------------------------------------------------
  // A peek remembers which posts it let through (by id), so X re-rendering the
  // timeline can't sneak in different ones. It survives reloads until it expires.

  let peek = store.get('peek'); // { n, until, ids }
  if (!(peek?.until > Date.now())) peek = null;
  const end = el('div', { class: 'jp-end' });

  function renderEnd(n) {
    end.replaceChildren(
      el('div', { class: 'jp-title', textContent: `that's ${n}.` }),
      el('div', { class: 'jp-line', textContent: 'back to quiet.' }),
      el('button', { class: 'jp-btn', textContent: 'done', onclick: endPeek, style: 'margin-top:12px' }),
    );
  }
  if (peek) renderEnd(peek.n);

  function startPeek(n) {
    peek = { n, until: Date.now() + PEEK_MINUTES * 60e3, ids: [] };
    store.set('peek', peek);
    store.set('lastPeekEnd', peek.until);
    renderEnd(n);
    tick();
    scrollTo(0, 0);
  }

  function endPeek() {
    peek = null;
    store.set('peek', null);
    store.set('lastPeekEnd', Math.min(Date.now(), store.get('lastPeekEnd') || Infinity));
    document.documentElement.classList.remove('jp-peek');
    document.querySelectorAll('[data-jp-ok]').forEach((e) => e.removeAttribute('data-jp-ok'));
    document.querySelectorAll('[data-jp-clip]').forEach((e) => e.removeAttribute('data-jp-clip'));
    end.remove();
    if (isHome(location.pathname)) scrollTo(0, 0);
    idle();
  }

  function postId(cell) {
    if (cell.hasAttribute('data-jp-ad')) return null;
    const link = cell.querySelector('article a[href*="/status/"] time')?.closest('a');
    return link?.getAttribute('href').match(/\/status\/(\d+)/)?.[1] || null;
  }

  function limitFeed() {
    const section = document.querySelector('[data-testid="primaryColumn"] section[role="region"]');
    if (!section) return;
    let list = null;
    let bottom = 0;
    for (const cell of section.querySelectorAll('[data-testid="cellInnerDiv"]')) {
      const id = postId(cell);
      if (id && !peek.ids.includes(id) && peek.ids.length < peek.n) {
        peek.ids.push(id);
        store.set('peek', peek);
      }
      const ok = Boolean(id) && peek.ids.includes(id);
      cell.toggleAttribute('data-jp-ok', ok);
      if (ok) {
        list = cell.parentElement;
        bottom = Math.max(bottom, cell.getBoundingClientRect().bottom - list.getBoundingClientRect().top);
      }
    }
    // If none of this peek's posts are on screen (say, after a reload), still show "done".
    list ||= section.querySelector('[data-testid="cellInnerDiv"]')?.parentElement;
    if (!list) return;
    list.style.setProperty('--jp-h', `${Math.ceil(bottom)}px`);
    list.setAttribute('data-jp-clip', '');
    if (list.nextElementSibling !== end) list.after(end);
  }

  // --- search ---------------------------------------------------------------
  // The explore tab normally opens trending; here it opens a bare search box.

  function openSearch() {
    if (document.getElementById('jp-search')) return;
    const input = el('input', {
      class: 'jp-input',
      type: 'search',
      placeholder: 'search x',
      enterKeyHint: 'search',
      autocomplete: 'off',
    });
    const sheet = el('div', { id: 'jp-search' },
      el('form', {
        onsubmit: (e) => {
          e.preventDefault();
          const q = input.value.trim();
          if (q) location.href = `/search?q=${encodeURIComponent(q)}&src=typed_query`;
        },
      }, input, el('button', { type: 'button', class: 'jp-faint', textContent: 'cancel', onclick: () => sheet.remove() })),
    );
    sheet.style.color = pickTextColor();
    const bg = getComputedStyle(document.body).backgroundColor;
    sheet.style.background = /rgba\(.*,\s*0\)$/.test(bg) ? '#fff' : bg;
    document.body.append(sheet);
    input.focus();
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest?.('[data-testid="AppTabBar_Explore_Link"], a[href="/explore"]')) return;
    e.preventDefault();
    e.stopPropagation();
    openSearch();
  }, true);

  // --- "posted ✓" ------------------------------------------------------------
  // X's web app sends posts and replies through a CreateTweet (or CreateNoteTweet,
  // for long posts) GraphQL call. Watch for its response on both fetch and XHR.

  const isCreate = (url) => /\/Create(Note)?Tweet(\?|$)/.test(String(url || ''));
  let toastTimer = null;

  function toast(ok, id) {
    let node = document.getElementById('jp-toast');
    if (!node) {
      node = el('div', { id: 'jp-toast' });
      document.body.append(node);
    }
    node.classList.toggle('jp-bad', !ok);
    node.replaceChildren(
      el('span', { textContent: ok ? 'posted ✓' : "that didn't post" }),
      ...(ok && id ? [el('a', {
        textContent: 'view',
        href: `/i/web/status/${id}`,
        onclick: (e) => { e.preventDefault(); location.href = `/i/web/status/${id}`; },
      })] : []),
    );
    requestAnimationFrame(() => node.classList.add('jp-show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('jp-show'), ok ? 5000 : 7000);
  }

  // Only claim success when X hands back the new post's id, and only claim failure
  // when X says so. Anything else is a response we don't recognize: stay quiet.
  function onCreateResponse(status, body) {
    let json = body;
    if (typeof body === 'string') { try { json = JSON.parse(body); } catch { json = null; } }
    const result = json?.data?.create_tweet?.tweet_results?.result
      || json?.data?.notetweet_create?.tweet_results?.result;
    const id = (result?.tweet || result)?.rest_id;
    if (status >= 200 && status < 300 && id && !json.errors?.length) toast(true, id);
    else if (status >= 400 || json?.errors?.length) toast(false);
  }

  const realFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = input instanceof Request ? input.url : String(input);
    const pending = realFetch.apply(this, arguments);
    if (isCreate(url)) {
      pending.then(
        (res) => res.clone().text().then((text) => onCreateResponse(res.status, text), () => {}),
        () => toast(false), // the request never reached x
      );
    }
    return pending;
  };

  const realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    // An XHR can be reused, so classify every request and listen only once per object.
    this.__jpCreate = isCreate(url);
    if (!this.__jpListening) {
      this.__jpListening = true;
      this.addEventListener('load', () => {
        if (!this.__jpCreate) return;
        const body = this.responseType === 'json' ? this.response
          : (this.responseType === '' || this.responseType === 'text') ? this.responseText : null;
        onCreateResponse(this.status, body);
      });
      this.addEventListener('error', () => { if (this.__jpCreate) toast(false); });
    }
    return realOpen.apply(this, arguments);
  };

  // --- ads -------------------------------------------------------------------
  // Promoted posts carry a visible "Ad" label next to the author ("Promoted" on
  // older builds). Don't go by X's tracking markers: those wrap every video too.

  function isAd(cell) {
    for (const span of cell.querySelectorAll('article span')) {
      const text = span.textContent;
      if ((text === 'Ad' || text === 'Promoted') && !span.closest('[data-testid="tweetText"]')) return true;
    }
    return false;
  }

  function markAds() {
    // Cells get recycled for other posts as you scroll, so check them all every time.
    for (const cell of document.querySelectorAll('[data-testid="cellInnerDiv"]')) {
      cell.toggleAttribute('data-jp-ad', isAd(cell));
    }
  }

  // --- main loop -----------------------------------------------------------

  let wasHome = false;
  let redirecting = false;

  function tick() {
    const path = location.pathname;

    if (BLOCKED.some((re) => re.test(path))) {
      if (!redirecting) location.replace('/home');
      redirecting = true;
      return;
    }
    redirecting = false;

    // The composer can open as a layer over home; keep the feed hidden behind it.
    const home = /^\/compose\//.test(path) ? wasHome : isHome(path);
    wasHome = home;
    document.documentElement.classList.toggle('jp-home', home);
    document.documentElement.classList.toggle('jp-card', isHome(path));

    markAds();
    if (peek && Date.now() > peek.until) endPeek();
    document.documentElement.classList.toggle('jp-peek', Boolean(peek));
    if (peek && isHome(path)) limitFeed();

    if (document.body && !card.isConnected) document.body.append(card);
    if (document.body) card.style.color = end.style.color = pickTextColor();
  }

  // X paints its theme as a background on body; pick readable text for it.
  function pickTextColor() {
    const bg = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g);
    if (!bg || bg[3] === '0') return '#0f1419';
    const [r, g, b] = bg.map(Number);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128 ? '#e7e9ea' : '#0f1419';
  }

  idle();
  tick();
  setInterval(tick, 300);
})();
