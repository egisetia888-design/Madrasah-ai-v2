import express from "express";
import http from "http";
import path from "path";
import app from "./server/app";

const NOOP_VITE_CLIENT = `import "/@vite/env";

const noop = () => {};
const hotDataMap = new Map();

export class ErrorOverlay extends (globalThis.HTMLElement || class {}) {}
if (globalThis.customElements && !globalThis.customElements.get("vite-error-overlay")) {
  globalThis.customElements.define("vite-error-overlay", ErrorOverlay);
}

export function createHotContext(ownerPath) {
  if (!hotDataMap.has(ownerPath)) {
    hotDataMap.set(ownerPath, {});
  }
  return {
    get data() {
      return hotDataMap.get(ownerPath);
    },
    accept: noop,
    acceptExports: noop,
    dispose: noop,
    prune: noop,
    decline: noop,
    invalidate: noop,
    on: noop,
    off: noop,
    send: noop,
  };
}

export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") {
    return url;
  }
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return \`\${pathname}?\${queryToInject}\${search ? "&" + search.slice(1) : ""}\${hash || ""}\`;
}

const sheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
const cspNonce = "document" in globalThis
  ? document.querySelector("meta[property=csp-nonce]")?.nonce
  : undefined;
let lastInsertedStyle;

export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (cspNonce) {
      style.setAttribute("nonce", cspNonce);
    }
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => {
        lastInsertedStyle = undefined;
      }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}

export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
`;

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const httpServer = http.createServer(app);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const hmrDisabled = process.env.DISABLE_HMR === "true";
    const viteModuleName = "vite";
    const { createServer: createViteServer } = await import(viteModuleName);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
        ws: !hmrDisabled,
      },
      appType: "spa",
    });
    if (hmrDisabled) {
      app.get("/@vite/client", (_req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.type("application/javascript");
        res.send(NOOP_VITE_CLIENT);
      });
    }
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
