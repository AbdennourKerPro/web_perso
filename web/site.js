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

    filterButtons.forEach(button => {
        button.addEventListener("click", () => {
            const filter = button.dataset.filter;
            filterButtons.forEach(other => other.setAttribute("aria-pressed", String(other === button)));
            projectCards.forEach(card => {
                const tags = card.dataset.tags?.split(" ") ?? [];
                card.hidden = filter !== "all" && !tags.includes(filter);
            });
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
        const index = dialogs.indexOf(dialog);
        const target = dialogs[(index + offset + dialogs.length) % dialogs.length];
        dialog.close();
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

        dialog.addEventListener("click", event => {
            if (event.target === dialog) dialog.close();
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
            counter.textContent = `${index + 1} / ${dialogs.length}`;

            const next = document.createElement("button");
            next.type = "button";
            next.textContent = "suivant →";
            next.addEventListener("click", () => step(dialog, 1));

            nav.append(previous, counter, next);
            dialog.append(nav);
        }
    });

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

    // Copy the main contact address
    document.querySelectorAll(".copy-email").forEach(button => {
        button.addEventListener("click", async () => {
            const label = button.textContent;
            try {
                await navigator.clipboard.writeText(button.dataset.copy);
                button.textContent = "copié";
            } catch (error) {
                button.textContent = "erreur";
            }
            setTimeout(() => { button.textContent = label; }, 1500);
        });
    });
})();
