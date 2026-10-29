/**
 * Une écriture venant d'un navigateur n'est acceptée que si la page qui l'envoie a la même origine
 * que le serveur appelé (en-tête Origin = en-tête Host relayé par Vite). Ça marche en local comme
 * sur le réseau (http://192.168.x.x:5173), et un autre site ouvert dans le navigateur reste refusé.
 * Sans en-tête Origin (curl, scripts), la requête ne vient pas d'une page web : acceptée.
 */
export function isSameOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  if (!host) return false;
  try {
    const url = new URL(origin);
    return (url.protocol === "http:" || url.protocol === "https:") && url.host === host;
  } catch {
    return false;
  }
}
