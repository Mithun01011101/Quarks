import crypto from "crypto";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import createMemoryStore from "memorystore";
import type { Express, NextFunction, Request, Response } from "express";
import { pool } from "./db";

// Paths reachable without logging in. The manifest and icons stay public so
// the phone can install the home-screen app before the user is signed in;
// /healthz stays public for Render's health checks.
const PUBLIC_PATHS = new Set(["/login", "/logout", "/manifest.webmanifest", "/healthz"]);

function isAuthed(req: Request): boolean {
  return Boolean((req.session as any)?.authed);
}

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function loginPage(showError: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="theme-color" content="#F2EFE3" />
<title>Quarks — Sign in</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: Georgia, 'Times New Roman', serif;
    background: hsl(47, 27%, 92%);
    color: hsl(42, 10%, 10%);
    padding: 24px;
  }
  .card {
    background: hsl(48, 45%, 98%); border: 1px solid hsl(45, 16%, 84%);
    border-radius: 28px; padding: 38px 28px;
    width: 100%; max-width: 360px; text-align: center;
    box-shadow: 0 14px 40px rgba(28, 27, 23, 0.08);
  }
  .mark {
    width: 64px; height: 64px; margin: 0 auto 16px; position: relative;
    border: 2px solid hsl(42, 10%, 16%); border-radius: 50%;
  }
  .mark span { width: 13px; height: 13px; border-radius: 50%; position: absolute; }
  .mark span:nth-child(1) { background: hsl(25, 90%, 55%); left: 50%; top: 12%; transform: translateX(-50%); }
  .mark span:nth-child(2) { background: hsl(40, 90%, 55%); left: 18%; bottom: 16%; }
  .mark span:nth-child(3) { background: hsl(140, 30%, 50%); right: 18%; bottom: 16%; }
  h1 { font-size: 34px; font-weight: 500; letter-spacing: -0.02em; margin-bottom: 6px; }
  p { color: hsl(42, 7%, 44%); font-size: 14px; margin-bottom: 26px;
      font-family: system-ui, -apple-system, sans-serif; }
  input {
    width: 100%; padding: 14px 16px; font-size: 16px;
    font-family: system-ui, -apple-system, sans-serif;
    background: hsl(46, 22%, 95%); color: hsl(42, 10%, 10%);
    border: 1px solid hsl(45, 16%, 80%);
    border-radius: 14px; margin-bottom: 14px; outline: none;
  }
  input:focus { border-color: hsl(42, 10%, 30%); }
  button {
    width: 100%; padding: 14px; font-size: 16px; font-weight: 600;
    font-family: system-ui, -apple-system, sans-serif;
    color: hsl(48, 45%, 97%); background: hsl(42, 10%, 11%);
    border: none; border-radius: 999px; cursor: pointer;
  }
  button:active { background: hsl(42, 10%, 22%); }
  .error { color: hsl(4, 66%, 46%); font-size: 14px; margin-bottom: 14px;
           font-family: system-ui, -apple-system, sans-serif; }
</style>
</head>
<body>
  <div class="card">
    <div class="mark" aria-hidden="true"><span></span><span></span><span></span></div>
    <h1>Quarks</h1>
    <p>Enter your password to continue</p>
    ${showError ? '<div class="error">Wrong password, try again.</div>' : ""}
    <form method="POST" action="/login">
      <input type="password" name="password" placeholder="Password" autofocus required />
      <button type="submit">Sign in</button>
    </form>
  </div>
</body>
</html>`;
}

export function setupAuth(app: Express) {
  const password = process.env.APP_PASSWORD;
  if (!password) return; // no password configured -> app stays open (local use)

  // Persist sessions in Postgres when available so logins survive restarts;
  // otherwise fall back to an in-memory store.
  const store = pool
    ? new (connectPgSimple(session))({ pool: pool as any, createTableIfMissing: true })
    : new (createMemoryStore(session))({ checkPeriod: 86_400_000 });

  app.use(
    session({
      secret: process.env.SESSION_SECRET || password,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 90 * 24 * 60 * 60 * 1000, // stay signed in for 90 days
      },
    })
  );

  app.get("/login", (req: Request, res: Response) => {
    if (isAuthed(req)) return res.redirect("/");
    res.status(200).type("html").send(loginPage("error" in req.query));
  });

  app.post("/login", (req: Request, res: Response) => {
    const attempt = typeof req.body?.password === "string" ? req.body.password : "";
    if (attempt && safeEqual(attempt, password)) {
      (req.session as any).authed = true;
      return res.redirect("/");
    }
    res.redirect("/login?error");
  });

  app.get("/logout", (req: Request, res: Response) => {
    req.session.destroy(() => res.redirect("/login"));
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (isAuthed(req)) return next();
    if (PUBLIC_PATHS.has(req.path) || req.path.startsWith("/icons/")) return next();
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    return res.redirect("/login");
  });
}
