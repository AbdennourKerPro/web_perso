/* =================================================================
   script.js — interactions, motion and project navigation
   Loaded on every page; each module bails out if its host node
   is missing, so nothing here is page-specific by accident.
   ================================================================= */

(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

    // Base path back to the site root, so injected links work from
    // /portfolio-projects/x/index.html as well as from /index.html
    const ROOT = (function () {
        // Directory depth, whether the URL ends in /index.html or just /
        const dir = window.location.pathname.replace(/[^/]*$/, '');
        const depth = dir.split('/').filter(Boolean).length;
        return depth > 0 ? '../'.repeat(depth) : '';
    })();

    // =================================================================
    // Theme (dark by default, persisted)
    // =================================================================
    const Theme = {
        get() { return localStorage.getItem('site_theme') || 'dark'; },
        apply(value) {
            document.documentElement.setAttribute('data-theme', value);
            localStorage.setItem('site_theme', value);
            document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
                btn.textContent = value === 'dark' ? '◐' : '◑';
                btn.setAttribute('aria-label', value === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
            });
        },
        toggle() { this.apply(this.get() === 'dark' ? 'light' : 'dark'); }
    };
    Theme.apply(Theme.get());

    // =================================================================
    // Reveal on scroll (also re-runnable after dynamic renders)
    // =================================================================
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const delay = Number(entry.target.dataset.revealDelay || 0);
            setTimeout(() => entry.target.classList.add('visible'), delay);
            revealObserver.unobserve(entry.target);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    function observeReveals(scope = document) {
        scope.querySelectorAll('.fade-in:not(.visible), .reveal:not(.visible)').forEach((el, i) => {
            if (!el.dataset.revealDelay) el.dataset.revealDelay = String(Math.min(i, 6) * 70);
            revealObserver.observe(el);
        });
    }

    // =================================================================
    // Boot
    // =================================================================
    document.addEventListener('DOMContentLoaded', () => {
        injectChrome();
        observeReveals();
        setupScrollProgress();
        setupCursorSpotlight();
        setupNavState();
        setupHeadingReveal();
        setupCardGlow();
        setupHeroTitle();
        setupNeuralCanvas();
        setupTocFab();
        loadContent();
    });

    // =================================================================
    // Site chrome: progress bar, nav tools, command palette
    // =================================================================
    function injectChrome() {
        const bar = document.createElement('div');
        bar.className = 'scroll-progress';
        document.body.prepend(bar);

        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
            const tools = document.createElement('div');
            tools.className = 'nav-tools';
            tools.innerHTML = `
                <button class="kbd-hint" data-cmdk-open type="button" aria-label="Open command palette">
                    <span>⌘</span>K
                </button>
                <button class="icon-btn" data-theme-toggle type="button">◐</button>
            `;
            navLinks.appendChild(tools);
            tools.querySelector('[data-theme-toggle]').addEventListener('click', () => Theme.toggle());
            tools.querySelector('[data-cmdk-open]').addEventListener('click', () => Palette.open());
            Theme.apply(Theme.get());
        }

        Palette.mount();
    }

    function setupScrollProgress() {
        const bar = document.querySelector('.scroll-progress');
        if (!bar) return;
        let ticking = false;
        const update = () => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const ratio = max > 0 ? window.scrollY / max : 0;
            bar.style.transform = `scaleX(${Math.min(ratio, 1)})`;
            ticking = false;
        };
        window.addEventListener('scroll', () => {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        update();
    }

    function setupNavState() {
        const nav = document.querySelector('nav');
        if (!nav) return;
        const update = () => nav.classList.toggle('scrolled', window.scrollY > 12);
        window.addEventListener('scroll', update, { passive: true });
        update();
    }

    // Ambient light follows the pointer via CSS custom properties
    function setupCursorSpotlight() {
        if (isCoarsePointer || prefersReducedMotion) return;
        let raf = null;
        window.addEventListener('pointermove', (e) => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                document.documentElement.style.setProperty('--mx', e.clientX + 'px');
                document.documentElement.style.setProperty('--my', e.clientY + 'px');
                raf = null;
            });
        }, { passive: true });
    }

    // Per-card glow tracking
    function setupCardGlow() {
        if (isCoarsePointer) return;
        document.addEventListener('pointermove', (e) => {
            const card = e.target.closest('.project-card, .project-card-cv');
            if (!card) return;
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--cx', `${e.clientX - rect.left}px`);
            card.style.setProperty('--cy', `${e.clientY - rect.top}px`);
        }, { passive: true });
    }

    // Section headings get a subtle reveal without extra markup
    function setupHeadingReveal() {
        document.querySelectorAll('.container h2, .cv-section, .project-header, .blog-header')
            .forEach(el => {
                if (el.closest('.hero') || el.classList.contains('reveal')) return;
                el.classList.add('reveal');
            });
        observeReveals();
    }

    // =================================================================
    // Floating "back to contents" button on pages that have a TOC
    // =================================================================
    function setupTocFab() {
        const toc = document.querySelector('.project-toc, .blog-toc');
        if (!toc) return;

        if (!toc.id) toc.id = 'toc';

        const fab = document.createElement('a');
        fab.className = 'toc-fab';
        fab.href = '#' + toc.id;
        fab.innerHTML = '<span>☰</span>Contents';
        document.body.appendChild(fab);

        // Visible only once the TOC itself has scrolled out of the way
        let ticking = false;
        const update = () => {
            fab.classList.toggle('shown', toc.getBoundingClientRect().bottom < 0);
            ticking = false;
        };
        window.addEventListener('scroll', () => {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        update();
    }

    // =================================================================
    // Hero: character-by-character title reveal
    // =================================================================
    function setupHeroTitle() {
        const title = document.querySelector('.hero h1');
        if (!title || title.dataset.split === 'done') return;
        const text = title.textContent.trim();
        title.dataset.split = 'done';
        title.setAttribute('aria-label', text);
        title.innerHTML = text.split('').map((ch, i) => {
            if (ch === ' ') return '<span class="char space" aria-hidden="true"> </span>';
            return `<span class="char" aria-hidden="true" style="animation-delay:${40 + i * 32}ms">${ch}</span>`;
        }).join('');
    }

    // =================================================================
    // Hero: living neural-network canvas
    // =================================================================
    function setupNeuralCanvas() {
        const canvas = document.getElementById('neuralCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const host = canvas.parentElement;

        let nodes = [];
        let width = 0;
        let height = 0;
        let pointer = { x: -999, y: -999 };
        const LINK_DIST = 108;

        function accent() {
            const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
            return raw || '#4de1ff';
        }

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const rect = host.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            seed();
        }

        function seed() {
            const count = Math.max(24, Math.min(58, Math.round((width * height) / 4200)));
            nodes = Array.from({ length: count }, () => ({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.28,
                vy: (Math.random() - 0.5) * 0.28,
                r: Math.random() * 1.6 + 0.9
            }));
        }

        function frame() {
            ctx.clearRect(0, 0, width, height);
            const color = accent();

            for (const n of nodes) {
                n.x += n.vx;
                n.y += n.vy;
                if (n.x < 0 || n.x > width) n.vx *= -1;
                if (n.y < 0 || n.y > height) n.vy *= -1;

                // gentle attraction toward the pointer
                const dx = pointer.x - n.x;
                const dy = pointer.y - n.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < 16000 && d2 > 1) {
                    n.x += dx * 0.0016;
                    n.y += dy * 0.0016;
                }
            }

            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const dist = Math.hypot(dx, dy);
                    if (dist > LINK_DIST) continue;
                    ctx.strokeStyle = color;
                    ctx.globalAlpha = (1 - dist / LINK_DIST) * 0.3;
                    ctx.lineWidth = 0.7;
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                }
            }

            ctx.globalAlpha = 1;
            for (const n of nodes) {
                const near = Math.hypot(pointer.x - n.x, pointer.y - n.y) < 90;
                ctx.fillStyle = color;
                ctx.globalAlpha = near ? 0.95 : 0.55;
                ctx.beginPath();
                ctx.arc(n.x, n.y, near ? n.r * 1.7 : n.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            if (!prefersReducedMotion) requestAnimationFrame(frame);
        }

        host.addEventListener('pointermove', (e) => {
            const rect = host.getBoundingClientRect();
            pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        });
        host.addEventListener('pointerleave', () => { pointer = { x: -999, y: -999 }; });

        window.addEventListener('resize', debounce(resize, 180));
        resize();
        frame();
    }

    // =================================================================
    // Content loading: blog index + project explorer
    // =================================================================
    async function loadContent() {
        let blogPosts = [];
        let projects = [];

        if (typeof SiteData !== 'undefined') {
            try {
                [blogPosts, projects] = await Promise.all([
                    SiteData.getBlogPosts(),
                    SiteData.getProjects()
                ]);
            } catch (e) {
                console.warn('Data load failed:', e);
            }
        }

        Palette.setData(blogPosts, projects);
        renderBlog(blogPosts);
        renderExplorer(projects);
    }

    // --- Blog index with pagination ---
    function renderBlog(blogPosts) {
        const container = document.getElementById('blogContainer');
        if (!container) return;

        const itemsPerPage = 3;
        let page = 0;
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');

        function render() {
            if (!blogPosts.length) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p>// no articles yet</p>
                        <p>Research notes are on their way.</p>
                    </div>`;
                if (prevBtn) prevBtn.style.display = 'none';
                if (nextBtn) nextBtn.style.display = 'none';
                return;
            }

            const start = page * itemsPerPage;
            const slice = blogPosts.slice(start, start + itemsPerPage);

            container.innerHTML = slice.map((post, i) => `
                <a href="${safeUrl(post.link)}" class="blog-card fade-in" data-reveal-delay="${i * 80}">
                    <div class="blog-meta">${escapeHtml(post.date)} · ${escapeHtml(post.readTime)} read</div>
                    <h3 class="blog-title">${escapeHtml(post.title)}</h3>
                    <p class="blog-snippet">${escapeHtml(post.snippet)}</p>
                </a>
            `).join('');

            if (prevBtn && nextBtn) {
                prevBtn.disabled = page === 0;
                nextBtn.disabled = start + itemsPerPage >= blogPosts.length;
            }
            observeReveals(container);
        }

        if (prevBtn) prevBtn.addEventListener('click', () => { if (page > 0) { page--; render(); } });
        if (nextBtn) nextBtn.addEventListener('click', () => {
            if ((page + 1) * itemsPerPage < blogPosts.length) { page++; render(); }
        });

        render();
    }

    // --- Project explorer: index + sticky preview, or grid ---
    function renderExplorer(projects) {
        const listEl = document.getElementById('explorerList');
        const gridEl = document.getElementById('portfolioContainer');
        if (!listEl && !gridEl) return;

        const chipsEl = document.getElementById('filterChips');
        const viewEl = document.getElementById('viewToggle');
        const explorerEl = document.getElementById('explorer');
        const previewEl = document.getElementById('explorerPreview');

        let filter = 'all';
        let active = 0;

        // Build filter chips from the union of project tags
        if (chipsEl) {
            // Keep the toolbar readable: the most represented tags first, capped at 8.
            const counts = new Map();
            projects.flatMap(p => p.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
            const tags = [...counts.entries()]
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                .slice(0, 8)
                .map(([t]) => t);
            chipsEl.innerHTML = [`<button class="chip active" data-filter="all">All · ${projects.length}</button>`]
                .concat(tags.map(t => `<button class="chip" data-filter="${escapeAttr(t)}">${escapeHtml(t)}</button>`))
                .join('');
            chipsEl.addEventListener('click', (e) => {
                const chip = e.target.closest('.chip');
                if (!chip) return;
                chipsEl.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
                filter = chip.dataset.filter;
                active = 0;
                render();
            });
        }

        if (viewEl) {
            viewEl.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                viewEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
                const isGrid = btn.dataset.view === 'grid';
                if (explorerEl) explorerEl.hidden = isGrid;
                if (gridEl) gridEl.hidden = !isGrid;
                render();
            });
        }

        function visible() {
            return filter === 'all' ? projects : projects.filter(p => (p.tags || []).includes(filter));
        }

        function render() {
            const items = visible();

            if (listEl) {
                if (!items.length) {
                    listEl.innerHTML = '<div class="empty-state">// no project matches this filter</div>';
                } else {
                    listEl.innerHTML = items.map((p, i) => `
                        <a href="${safeUrl(p.link)}" class="explorer-row${i === active ? ' is-active' : ''}" data-idx="${i}">
                            <span class="explorer-index">${String(i + 1).padStart(2, '0')}</span>
                            <span>
                                <span class="explorer-row-title">${escapeHtml(p.title)}</span>
                                <span class="explorer-row-sub">${(p.tags || []).slice(0, 3).map(escapeHtml).join(' · ')}${p.date ? ' · ' + escapeHtml(p.date) : ''}</span>
                            </span>
                            <span class="explorer-row-arrow">→</span>
                        </a>
                    `).join('');
                }
            }

            if (gridEl) {
                gridEl.innerHTML = items.map((p, i) => `
                    <div class="project-card fade-in">
                        <div class="project-content">
                            <span class="card-index">${String(i + 1).padStart(2, '0')}</span>
                            <span class="project-kicker">${escapeHtml(p.date || '')}</span>
                            <h3>${escapeHtml(p.title)}</h3>
                            <p>${escapeHtml(p.description)}</p>
                            <div class="tags" style="margin-top:1rem">
                                ${(p.tags || []).slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
                            </div>
                            <a href="${safeUrl(p.link)}" class="project-link">View project →</a>
                        </div>
                    </div>
                `).join('');
                observeReveals(gridEl);
            }

            if (items.length) setPreview(items[Math.min(active, items.length - 1)]);
            else if (previewEl) previewEl.innerHTML = '';
        }

        function setPreview(project) {
            if (!previewEl || !project) return;
            const initials = project.title.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
            previewEl.innerHTML = `
                <div class="preview-canvas">
                    <div class="preview-art grad-text">${escapeHtml(initials)}</div>
                </div>
                <div class="preview-body preview-fade">
                    <span class="preview-kicker">${escapeHtml(project.date || 'project')}</span>
                    <h3 class="preview-title">${escapeHtml(project.title)}</h3>
                    <p class="preview-desc">${escapeHtml(project.description)}</p>
                    <div class="tags preview-tags">
                        ${(project.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
                    </div>
                    <a href="${safeUrl(project.link)}" class="cta-button">Open case study →</a>
                </div>`;
            requestAnimationFrame(() => {
                const art = previewEl.querySelector('.preview-art');
                if (art) art.classList.add('shown');
            });
        }

        if (listEl) {
            listEl.addEventListener('pointerover', (e) => {
                const row = e.target.closest('.explorer-row');
                if (!row) return;
                active = Number(row.dataset.idx);
                listEl.querySelectorAll('.explorer-row').forEach(r => r.classList.toggle('is-active', r === row));
                setPreview(visible()[active]);
            });

            // Keyboard navigation. j/k work anywhere on the page; the arrow keys
            // only take over once focus is inside the list, so normal scrolling
            // is never hijacked.
            document.addEventListener('keydown', (e) => {
                if (Palette.isOpen()) return;
                const tag = document.activeElement && document.activeElement.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;

                const isArrow = e.key === 'ArrowDown' || e.key === 'ArrowUp';
                const isVim = e.key === 'j' || e.key === 'k';
                if (!isArrow && !isVim) return;
                if (isArrow && !listEl.contains(document.activeElement)) return;

                const rows = listEl.querySelectorAll('.explorer-row');
                if (!rows.length) return;
                e.preventDefault();

                const delta = (e.key === 'ArrowDown' || e.key === 'j') ? 1 : -1;
                active = (active + delta + rows.length) % rows.length;
                rows.forEach((r, i) => r.classList.toggle('is-active', i === active));
                rows[active].focus({ preventScroll: true });
                rows[active].scrollIntoView({ block: 'nearest' });
                setPreview(visible()[active]);
            });
        }

        render();
    }

    // =================================================================
    // Command palette (⌘K / Ctrl+K)
    // =================================================================
    const Palette = (() => {
        let overlay = null;
        let input = null;
        let resultsEl = null;
        let items = [];
        let selected = 0;
        let staticEntries = [];

        function base() {
            return [
                { label: 'Home', hint: '↵', href: ROOT + 'index.html', group: 'Navigation', icon: '⌂' },
                { label: 'Portfolio', hint: '↵', href: ROOT + 'portfolio.html', group: 'Navigation', icon: '▤' },
                { label: 'CV', hint: '↵', href: ROOT + 'cv.html', group: 'Navigation', icon: '✦' },
                { label: 'Blog', hint: '↵', href: ROOT + 'index.html#blog', group: 'Navigation', icon: '✎' },
                { label: 'Toggle theme', group: 'Actions', icon: '◐', action: () => Theme.toggle() },
                { label: 'Scroll to top', group: 'Actions', icon: '↑', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) }
            ];
        }

        function mount() {
            overlay = document.createElement('div');
            overlay.className = 'cmdk-overlay';
            overlay.innerHTML = `
                <div class="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
                    <div class="cmdk-input-row">
                        <span>&gt;</span>
                        <input type="text" placeholder="Search projects, articles, pages…" aria-label="Search">
                    </div>
                    <div class="cmdk-results"></div>
                    <div class="cmdk-footer">
                        <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
                    </div>
                </div>`;
            document.body.appendChild(overlay);

            input = overlay.querySelector('input');
            resultsEl = overlay.querySelector('.cmdk-results');
            staticEntries = base();

            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
            input.addEventListener('input', () => { selected = 0; renderResults(); });

            resultsEl.addEventListener('click', (e) => {
                const el = e.target.closest('.cmdk-item');
                if (el) run(items[Number(el.dataset.i)]);
            });

            document.addEventListener('keydown', (e) => {
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                    e.preventDefault();
                    isOpen() ? close() : open();
                    return;
                }
                if (!isOpen()) return;
                if (e.key === 'Escape') { e.preventDefault(); close(); }
                else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
                else if (e.key === 'Enter') { e.preventDefault(); run(items[selected]); }
            });
        }

        function setData(posts, projects) {
            staticEntries = base()
                .concat(projects.map(p => ({
                    label: p.title, group: 'Projects', icon: '◆',
                    href: ROOT + stripLeading(p.link)
                })))
                .concat(posts.map(p => ({
                    label: p.title, group: 'Articles', icon: '✎',
                    href: ROOT + stripLeading(p.link)
                })));
            if (isOpen()) renderResults();
        }

        function stripLeading(link) {
            return String(link || '').replace(/^\.?\//, '');
        }

        function renderResults() {
            const q = (input.value || '').toLowerCase().trim();
            items = q
                ? staticEntries.filter(e => e.label.toLowerCase().includes(q))
                : staticEntries;

            if (!items.length) {
                resultsEl.innerHTML = '<div class="cmdk-empty">No result</div>';
                return;
            }

            let html = '';
            let group = null;
            items.forEach((e, i) => {
                if (e.group !== group) {
                    group = e.group;
                    html += `<div class="cmdk-group-label">${escapeHtml(group)}</div>`;
                }
                html += `<div class="cmdk-item${i === selected ? ' selected' : ''}" data-i="${i}">
                    <span class="cmdk-icon">${e.icon}</span><span>${escapeHtml(e.label)}</span>
                </div>`;
            });
            resultsEl.innerHTML = html;
        }

        function move(delta) {
            if (!items.length) return;
            selected = (selected + delta + items.length) % items.length;
            renderResults();
            const el = resultsEl.querySelector('.cmdk-item.selected');
            if (el) el.scrollIntoView({ block: 'nearest' });
        }

        function run(entry) {
            if (!entry) return;
            close();
            if (entry.action) entry.action();
            else if (entry.href) window.location.href = entry.href;
        }

        function open() {
            if (!overlay) return;
            overlay.classList.add('open');
            input.value = '';
            selected = 0;
            renderResults();
            setTimeout(() => input.focus(), 40);
        }

        function close() { if (overlay) overlay.classList.remove('open'); }
        function isOpen() { return !!overlay && overlay.classList.contains('open'); }

        return { mount, setData, open, close, isOpen };
    })();

    // =================================================================
    // Utils
    // =================================================================
    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function escapeAttr(str) { return escapeHtml(str); }

    // Content links come from the CMS, so keep them relative/http only
    function safeUrl(url) {
        const raw = String(url == null ? '' : url).trim();
        return /^(https?:|\/|[\w.-]+\/|[\w.-]+\.html)/i.test(raw) ? escapeHtml(raw) : '#';
    }

    function debounce(fn, ms) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    }
    // Public pages intentionally use a single light theme.
    window.addEventListener('DOMContentLoaded', () => {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('site_theme', 'light');
        document.querySelectorAll('[data-theme-toggle]').forEach(button => button.remove());
    });
})();
