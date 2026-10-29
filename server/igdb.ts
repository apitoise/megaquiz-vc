// Client IGDB côté Node : le secret Twitch ne quitte jamais cette machine (ni le navigateur, ni git).
// Token « client credentials » mis en cache et renouvelé à expiration (ou sur 401).

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const API_URL = "https://api.igdb.com/v4";
/** IGDB : 4 requêtes / s au maximum. */
const MIN_INTERVAL_MS = 260;
/** Marge avant expiration pour renouveler le token. */
const EXPIRY_MARGIN_MS = 60_000;
const TIMEOUT_MS = 20_000;

interface Token {
  value: string;
  expiresAt: number;
}

export class IgdbClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly fetchImpl: typeof fetch;
  private token: Token | null = null;
  private pendingToken: Promise<Token> | null = null;
  private nextSlot = 0;

  constructor(clientId: string, clientSecret: string, fetchImpl: typeof fetch = fetch) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.fetchImpl = fetchImpl;
  }

  /** Client configuré depuis TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET, ou erreur explicite. */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): IgdbClient {
    const { TWITCH_CLIENT_ID: id, TWITCH_CLIENT_SECRET: secret } = env;
    if (!id || !secret) throw new Error("TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET doivent être définis dans .env");
    return new IgdbClient(id, secret);
  }

  /** Requête Apicalypse, par ex. query("games", "fields name; where id = 1942;"). */
  async query<T>(endpoint: string, body: string): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      await this.throttle();
      const token = await this.getToken();
      const res = await this.fetchImpl(`${API_URL}/${endpoint}`, {
        method: "POST",
        headers: { "Client-ID": this.clientId, Authorization: `Bearer ${token.value}`, Accept: "application/json" },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 401 && attempt === 1) {
        this.token = null; // token révoqué ou expiré plus tôt que prévu
        continue;
      }
      if (res.status === 429 && attempt < 5) {
        await sleep(1000 * attempt);
        continue;
      }
      if (!res.ok) throw new Error(`IGDB ${endpoint} : HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      return (await res.json()) as T;
    }
  }

  private async getToken(): Promise<Token> {
    if (this.token && Date.now() < this.token.expiresAt - EXPIRY_MARGIN_MS) return this.token;
    // Une seule demande de token à la fois, même si plusieurs requêtes arrivent ensemble.
    this.pendingToken ??= this.requestToken().finally(() => (this.pendingToken = null));
    this.token = await this.pendingToken;
    return this.token;
  }

  private async requestToken(): Promise<Token> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "client_credentials",
    });
    const res = await this.fetchImpl(`${TOKEN_URL}?${params}`, { method: "POST", signal: AbortSignal.timeout(TIMEOUT_MS) });
    // Ne jamais journaliser l'URL : elle contient le secret.
    if (!res.ok) throw new Error(`Token Twitch refusé : HTTP ${res.status} (vérifiez les identifiants du .env)`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    return { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + MIN_INTERVAL_MS;
    if (slot > now) await sleep(slot - now);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
