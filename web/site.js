(() => {
    "use strict";

    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

    const readStored = (key) => {
        try { return localStorage.getItem(key); } catch (error) { return null; }
    };
    const writeStored = (key, value) => {
        try { localStorage.setItem(key, value); } catch (error) { /* private mode: keep the choice for this visit only */ }
    };

    // Theme toggle: switches to the opposite of what is currently shown
    const themeButton = document.querySelector(".theme-toggle");
    const shownTheme = () => root.dataset.theme || (systemDark.matches ? "dark" : "light");

    const paintThemeButton = () => {
        if (!themeButton) return;
        const target = shownTheme() === "dark" ? "clair" : "sombre";
        themeButton.textContent = `thème ${target}`;
        themeButton.setAttribute("aria-label", `Passer au thème ${target}`);
    };

    themeButton?.addEventListener("click", () => {
        const next = shownTheme() === "dark" ? "light" : "dark";
        root.dataset.theme = next;
        writeStored("theme", next);
        paintThemeButton();
    });

    systemDark.addEventListener?.("change", paintThemeButton);
    paintThemeButton();

    // Sticky navigation: highlight the section currently on screen
    const jumpLinks = [...document.querySelectorAll(".jump-links a")];
    if ("IntersectionObserver" in window && jumpLinks.length) {
        const linkFor = new Map(jumpLinks.map(link => [link.hash.slice(1), link]));
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                jumpLinks.forEach(link => link.removeAttribute("aria-current"));
                linkFor.get(entry.target.id)?.setAttribute("aria-current", "true");
            });
        }, { rootMargin: "-20% 0px -70% 0px" });

        linkFor.forEach((_, id) => {
            const section = document.getElementById(id);
            if (section) observer.observe(section);
        });
    }

    // Project filters by skill
    const filterButtons = [...document.querySelectorAll(".filter-bar button")];
    const projectCards = [...document.querySelectorAll(".project-trigger")];
    const counters = new Map();

    // Windows of the cards the filter currently shows, in page order
    const visibleDialogs = () => projectCards
        .filter(card => !card.hidden)
        .map(card => document.getElementById(card.dataset.dialog))
        .filter(Boolean);

    const cardFor = dialog => projectCards.find(card => card.dataset.dialog === dialog.id);

    const updateCounters = () => {
        const list = visibleDialogs();
        counters.forEach((counter, dialog) => {
            const position = list.indexOf(dialog);
            counter.textContent = position === -1 ? "" : `${position + 1} / ${list.length}`;
        });
    };

    filterButtons.forEach(button => {
        button.addEventListener("click", () => {
            const filter = button.dataset.filter;
            filterButtons.forEach(other => other.setAttribute("aria-pressed", String(other === button)));
            projectCards.forEach(card => {
                const tags = card.dataset.tags?.split(" ") ?? [];
                card.hidden = filter !== "all" && !tags.includes(filter);
            });
            updateCounters();
        });
    });

    // Project windows: open, previous / next, keyboard arrows, and #deep links
    const dialogs = projectCards
        .map(card => document.getElementById(card.dataset.dialog))
        .filter(Boolean);

    const openDialog = (dialog) => {
        if (typeof dialog.showModal !== "function") return;
        if (!dialog.open) dialog.showModal();
        history.replaceState(null, "", `#${dialog.id}`);
    };

    const step = (dialog, offset) => {
        const list = visibleDialogs();
        const index = list.indexOf(dialog);
        if (index === -1 || list.length < 2) return;
        const target = list[(index + offset + list.length) % list.length];
        dialog.close();
        // Focus the target's card first, so closing that window returns focus to it
        cardFor(target)?.focus();
        openDialog(target);
    };

    projectCards.forEach(card => {
        card.addEventListener("click", () => {
            const dialog = document.getElementById(card.dataset.dialog);
            if (dialog) openDialog(dialog);
        });
    });

    dialogs.forEach((dialog, index) => {
        dialog.querySelector(".modal-close")?.addEventListener("click", () => dialog.close());

        // Close on a click on the backdrop only: the dialog's padding and gaps also hit the dialog itself
        dialog.addEventListener("click", event => {
            if (event.target !== dialog) return;
            const box = dialog.getBoundingClientRect();
            const inside = event.clientX >= box.left && event.clientX <= box.right
                && event.clientY >= box.top && event.clientY <= box.bottom;
            if (!inside) dialog.close();
        });

        // Closing with a switch to the next window leaves the hash in place
        dialog.addEventListener("close", () => {
            if (!document.querySelector("dialog[open]")) {
                history.replaceState(null, "", location.pathname + location.search);
            }
        });

        if (dialogs.length > 1) {
            const nav = document.createElement("div");
            nav.className = "modal-nav";

            const previous = document.createElement("button");
            previous.type = "button";
            previous.textContent = "← précédent";
            previous.addEventListener("click", () => step(dialog, -1));

            const counter = document.createElement("span");
            counters.set(dialog, counter);

            const next = document.createElement("button");
            next.type = "button";
            next.textContent = "suivant →";
            next.addEventListener("click", () => step(dialog, 1));

            nav.append(previous, counter, next);
            dialog.append(nav);
        }
    });

    updateCounters();

    document.addEventListener("keydown", event => {
        const open = dialogs.find(dialog => dialog.open);
        if (!open) return;
        if (event.key === "ArrowRight") step(open, 1);
        if (event.key === "ArrowLeft") step(open, -1);
    });

    const openFromHash = () => {
        const dialog = dialogs.find(item => `#${item.id}` === location.hash);
        if (dialog && !dialog.open) openDialog(dialog);
    };
    window.addEventListener("hashchange", openFromHash);
    openFromHash();

    // Sections fade in as they scroll into view; without IntersectionObserver they simply stay visible
    if ("IntersectionObserver" in window) {
        const revealer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                revealer.unobserve(entry.target);
            });
        }, { rootMargin: "0px 0px -10% 0px" });

        document.querySelectorAll(".section").forEach(section => {
            section.classList.add("reveal");
            revealer.observe(section);
        });
    }

    // Now: switch the Spotify player between the chosen playlists
    const playerTabs = [...document.querySelectorAll(".player-tabs button")];
    const player = document.getElementById("spotify-player");
    playerTabs.forEach(button => {
        button.addEventListener("click", () => {
            playerTabs.forEach(other => other.setAttribute("aria-pressed", String(other === button)));
            if (player) player.src = button.dataset.src;
        });
    });

    // Copy the main contact address
    document.querySelectorAll(".copy-email").forEach(button => {
        const label = button.textContent;
        let timer;
        button.addEventListener("click", async () => {
            let message = "erreur";
            try {
                await navigator.clipboard.writeText(button.dataset.copy);
                message = "copié";
            } catch (error) {
                // keep "erreur"
            }
            button.textContent = message;
            clearTimeout(timer);
            timer = setTimeout(() => { button.textContent = label; }, 1500);
        });
    });
})();
