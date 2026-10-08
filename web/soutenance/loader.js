// Unlocks deck.bin (see scripts/encrypt-soutenance.mjs) in the browser and
// renders one of its HTML pages in place. Nothing readable is served in clear.
(function () {
  const page = document.documentElement.dataset.page; // 'index.html' or 'presenter.html'
  const form = document.getElementById('unlock');
  const input = document.getElementById('password');
  const msg = document.getElementById('msg');

  async function decrypt(password) {
    const res = await fetch('/soutenance/deck.bin', { cache: 'no-cache' });
    if (!res.ok) throw new Error('fetch');
    const buf = new Uint8Array(await res.arrayBuffer());
    const salt = buf.slice(5, 21), iv = buf.slice(21, 33), data = buf.slice(33);
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data));
    const len = new DataView(plain.buffer).getUint32(0);
    const manifest = JSON.parse(new TextDecoder().decode(plain.subarray(4, 4 + len)));
    let off = 4 + len;
    const files = {};
    for (const f of manifest) {
      files[f.name] = { type: f.type, bytes: plain.subarray(off, off + f.size) };
      off += f.size;
    }
    return files;
  }

  // Turns the decrypted files into ready-to-write HTML pages: assets become
  // blob URLs and local scripts are inlined.
  function build(files) {
    const urls = {}, text = {};
    for (const [name, f] of Object.entries(files)) {
      if (/^text\//.test(f.type)) text[name] = new TextDecoder().decode(f.bytes);
      else urls[name] = URL.createObjectURL(new Blob([f.bytes], { type: f.type }));
    }
    const swap = s => Object.entries(urls).reduce((acc, [name, url]) =>
      acc.split('"' + name + '"').join('"' + url + '"').split("'" + name + "'").join("'" + url + "'"), s);
    const pages = {};
    for (const name of Object.keys(text).filter(n => n.endsWith('.html'))) {
      pages[name] = swap(text[name])
        .replace(/<script src="([^"]+)"><\/script>/g, (m, src) =>
          text[src] ? '<script>' + swap(text[src]).replace(/<\/script/gi, '<\/script') + '</script>' : m)
        .replace(/<head>/i, '<head><base href="/soutenance/"><meta name="robots" content="noindex, nofollow">');
    }
    return pages;
  }

  // Writes the decrypted page and, on the index page, answers requests from
  // the presenter window opened with the P key.
  function show(pages) {
    window.__soutenance = pages;
    document.open();
    document.write(pages[page]);
    document.close();
    window.addEventListener('message', e => {
      if (e.origin !== location.origin || !e.source || !window.__soutenance) return;
      if (e.data && e.data.type === 'soutenance-request') {
        e.source.postMessage({ type: 'soutenance-pages', pages: window.__soutenance }, location.origin);
      }
    });
  }

  // Presenter window: ask the deck window for the pages it already decrypted,
  // so the password is only asked when the presenter is opened on its own.
  function askOpener() {
    return new Promise(resolve => {
      const timer = setTimeout(() => { window.removeEventListener('message', onReply); resolve(null); }, 1500);
      function onReply(e) {
        if (e.origin !== location.origin || !e.data || e.data.type !== 'soutenance-pages') return;
        clearTimeout(timer);
        window.removeEventListener('message', onReply);
        resolve(e.data.pages);
      }
      window.addEventListener('message', onReply);
      try { window.opener.postMessage({ type: 'soutenance-request' }, location.origin); }
      catch (e) { clearTimeout(timer); window.removeEventListener('message', onReply); resolve(null); }
    });
  }

  function askPassword() {
    form.hidden = false;
    input.focus();
    form.addEventListener('submit', async e => {
      e.preventDefault();
      msg.textContent = 'Déverrouillage…';
      form.querySelector('button').disabled = true;
      try {
        show(build(await decrypt(input.value)));
      } catch (err) {
        msg.textContent = err.message === 'fetch' ? 'Présentation indisponible.' : 'Mot de passe incorrect.';
        form.querySelector('button').disabled = false;
        input.select();
      }
    });
  }

  if (page === 'presenter.html' && window.opener) {
    msg.textContent = 'Ouverture de la vue présentateur…';
    askOpener().then(pages => {
      if (pages) show(pages);
      else { msg.textContent = ''; askPassword(); }
    });
  } else {
    askPassword();
  }
})();
