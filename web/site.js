(() => {
    "use strict";

    document.querySelectorAll("[data-dialog]").forEach(trigger => {
        const dialog = document.getElementById(trigger.dataset.dialog);
        if (!dialog) return;

        trigger.addEventListener("click", () => {
            if (typeof dialog.showModal === "function") dialog.showModal();
        });
    });

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

    document.querySelectorAll(".project-modal").forEach(dialog => {
        dialog.querySelector(".modal-close")?.addEventListener("click", () => dialog.close());

        dialog.addEventListener("click", event => {
            if (event.target === dialog) dialog.close();
        });
    });
})();
