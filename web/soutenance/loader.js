// Unlocks deck.bin (see scripts/encrypt-soutenance.mjs) in the browser and
// renders one of its HTML pages in place. Nothing readable is served in clear.
(function () {
  const page = document.documentElement.dataset.page; // 'index.html' or 'presenter.html'

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
          text[src] ? '<script>' + swap(text[src]).replace(/<\/script/gi, '<\\/script') + '</script>' : m)
        .replace(/<head>/i, '<head><base href="/soutenance/"><meta name="robots" content="noindex, nofollow">');
    }
    return pages;
  }

  function show(pages) {
    window.__soutenance = pages;
    const html = pages[page];
    document.open();
    document.write(html);
    document.close();
  }

  // Presenter window opened from the unlocked deck: reuse what it already decrypted.
  try {
    if (window.opener && window.opener.__soutenance) { show(window.opener.__soutenance); return; }
  } catch (e) { /* different origin: ask for the password */ }

  const form = document.getElementById('unlock');
  const input = document.getElementById('password');
  const msg = document.getElementById('msg');
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
})();
