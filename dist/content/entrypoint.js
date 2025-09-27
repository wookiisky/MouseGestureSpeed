"use strict";
// Simple dynamic entrypoint for content script
// This file avoids static imports so it can run as a classic script.
// Attempts to dynamically import the content module
const tryImport = async (url) => {
    // Try to import a module URL and return true on success
    try {
        await import(url);
        return true;
    }
    catch (error) {
        console.warn("[ContentEntrypoint] Dynamic import failed", { url, error });
        return false;
    }
};

// Shows a clickable reload prompt overlay
const showReloadPrompt = () => {
    try {
        if (document.getElementById("mg-reload-prompt")) {
            return;
        }
        const el = document.createElement("div");
        el.id = "mg-reload-prompt";
        el.textContent = "Click to reload page, to enable MouseGestureSpeed";
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        el.style.position = "fixed";
        el.style.right = "16px";
        el.style.bottom = "16px";
        el.style.zIndex = "2147483647";
        el.style.background = "#111";
        el.style.color = "#fff";
        el.style.padding = "10px 12px";
        el.style.borderRadius = "8px";
        el.style.boxShadow = "0 2px 10px rgba(0,0,0,0.4)";
        el.style.fontFamily = "-apple-system,Segoe UI,Helvetica,Arial,sans-serif";
        el.style.fontSize = "13px";
        el.style.cursor = "pointer";
        el.style.userSelect = "none";
        el.addEventListener("click", () => {
            console.info("[ContentEntrypoint] Reload prompt clicked");
            window.location.reload();
        });
        el.addEventListener("keydown", (e) => {
            // Activate with Enter/Space
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                el.click();
            }
        });
        document.documentElement.appendChild(el);
        console.info("[ContentEntrypoint] Inserted reload prompt overlay");
    }
    catch (e) {
        console.warn("[ContentEntrypoint] Failed to insert reload prompt", e);
    }
};
// Boots the content script by importing the module entry
const bootstrap = async () => {
    console.info("[ContentEntrypoint] Starting bootstrap");
    // Try both paths to support loading from project root or packaged dist
    const candidates = [
        "content/index.js",
        "dist/content/index.js"
    ];
    for (const path of candidates) {
        const url = chrome.runtime.getURL(path);
        // Attempt import of the candidate path
        // eslint-disable-next-line no-await-in-loop
        const ok = await tryImport(url);
        if (ok) {
            console.info("[ContentEntrypoint] Loaded module", { path });
            return;
        }
    }
    console.error("[ContentEntrypoint] Failed to load content module");
    // Show a user-facing prompt to reload the page so the extension can reattach
    showReloadPrompt();
};
// Start the bootstrap process
void bootstrap();
