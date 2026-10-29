type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

/** Petit utilitaire de création d'éléments : h("div", { class: "x", onclick: fn }, enfants…). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === "function") el.addEventListener(name.slice(2), value);
    else if (value === true) el.setAttribute(name, "");
    else el.setAttribute(name, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/**
 * Bouton d'action qui affiche sa touche (« [A] Arthur »). Il ne prend jamais le focus :
 * sinon Espace « recliquerait » le dernier bouton en plus du raccourci global.
 */
export function actionButton(key: string | null, label: string, onClick: () => void, extraClass = ""): HTMLButtonElement {
  return h(
    "button",
    {
      class: `action ${extraClass}`.trim(),
      type: "button",
      tabindex: -1,
      onmousedown: (e: Event) => e.preventDefault(),
      onclick: onClick,
    },
    key ? h("kbd", {}, key) : null,
    label,
  );
}

/** Bascule le plein écran (utile sur une télé) ; silencieux si le navigateur refuse. */
export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  else void document.documentElement.requestFullscreen?.().catch(() => {});
}

let toastHost: HTMLElement | null = null;

/** Message discret, en bas de l'écran. */
export function toast(message: string): void {
  toastHost ??= document.body.appendChild(h("div", { class: "toasts", "aria-live": "polite" }));
  const el = toastHost.appendChild(h("div", { class: "toast" }, message));
  setTimeout(() => el.remove(), 4500);
}
