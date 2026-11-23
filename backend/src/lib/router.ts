import type { IncomingMessage, ServerResponse } from 'http';
import { notFound, readForm, readJson, sendError, sendJson } from './http';
import type { AuthUser } from '../auth';

/** Per-request context passed to every handler. */
export class Ctx {
  user?: AuthUser;
  status = 200;
  /** Set when a handler has written the response itself (downloads). */
  sent = false;
  constructor(
    public req: IncomingMessage,
    public res: ServerResponse,
    public params: Record<string, string>,
    public query: URLSearchParams,
  ) {}
  /** The signed-in user. Only call after the `auth` step. */
  get me(): AuthUser {
    if (!this.user) throw new Error('auth step missing');
    return this.user;
  }
  json() {
    return readJson(this.req);
  }
  form() {
    return readForm(this.req);
  }
  param(name: string) {
    return Number(this.params[name]);
  }
}

export type Step = (ctx: Ctx) => unknown | Promise<unknown>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  steps: Step[];
}

/** Minimal router: `/api/funding/:id` style paths, a chain of steps, JSON responses. */
export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, ...steps: Step[]) {
    const keys: string[] = [];
    // '/' inside a mounted router means "the prefix itself".
    const clean = path === '/' ? '' : path;
    const pattern = new RegExp(
      '^' + clean.replace(/\/:([a-zA-Z]+)/g, (_, k: string) => (keys.push(k), '/([^/]+)')) + '/?$',
    );
    this.routes.push({ method, pattern, keys, steps });
    return this;
  }
  get = (path: string, ...steps: Step[]) => this.add('GET', path, ...steps);
  post = (path: string, ...steps: Step[]) => this.add('POST', path, ...steps);
  put = (path: string, ...steps: Step[]) => this.add('PUT', path, ...steps);
  delete = (path: string, ...steps: Step[]) => this.add('DELETE', path, ...steps);

  /** Mounts another router's routes under a prefix. */
  use(prefix: string, other: Router) {
    for (const r of other.routes) {
      const source = r.pattern.source.slice(1); // drop ^
      this.routes.push({ ...r, pattern: new RegExp('^' + prefix.replace(/\//g, '\\/') + source) });
    }
    return this;
  }

  async handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url || '/', 'http://local');
    const path = url.pathname;
    try {
      for (const r of this.routes) {
        if (r.method !== req.method) continue;
        const m = r.pattern.exec(path);
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        const ctx = new Ctx(req, res, params, url.searchParams);
        let result: unknown;
        for (const step of r.steps) result = await step(ctx);
        if (!ctx.sent && !res.headersSent) sendJson(res, ctx.status, result ?? { ok: true });
        return;
      }
      throw notFound('Unknown API route.');
    } catch (err) {
      sendError(res, err);
    }
  }
}
