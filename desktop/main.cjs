const { app, BrowserWindow, shell } = require("electron");
const { createServer } = require("node:http");
const next = require("next");
const { parse } = require("node:url");

let mainWindow;
let server;

async function createWindow() {
  const url = process.env.CRASHSENSE_DESKTOP_URL || (await startNextServer());

  mainWindow = new BrowserWindow({
    width: 1220,
    height: 860,
    minWidth: 920,
    minHeight: 640,
    backgroundColor: "#0f172a",
    title: "CrashSense AI",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);

    return { action: "deny" };
  });

  await mainWindow.loadURL(url);
}

async function startNextServer() {
  const dir = app.getAppPath();
  const port = await findOpenPort(3217);
  const nextApp = next({
    dev: false,
    dir,
    hostname: "127.0.0.1",
    port,
  });
  const handle = nextApp.getRequestHandler();

  await nextApp.prepare();

  server = createServer((request, response) => {
    const parsedUrl = parse(request.url || "/", true);
    handle(request, response, parsedUrl);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return `http://127.0.0.1:${port}`;
}

async function findOpenPort(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await canListen(port)) {
      return port;
    }
  }

  throw new Error("No open local port found for CrashSense AI.");
}

function canListen(port) {
  return new Promise((resolve) => {
    const probe = createServer();

    probe.once("error", () => resolve(false));
    probe.once("listening", () => {
      probe.close(() => resolve(true));
    });
    probe.listen(port, "127.0.0.1");
  });
}

app.whenReady().then(createWindow).catch((error) => {
  console.error(error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (server) {
    server.close();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
