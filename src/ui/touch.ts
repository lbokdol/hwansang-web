// On-screen touch controls for mobile. Dispatches synthetic keydown events
// through the existing window handler, so every scene keeps working unchanged.

import type { Renderer } from "../render/renderer";
import { sfx } from "../audio/sfx";

export interface TouchButton {
  label: string;
  key: string;
}

/** Fallback bottom inset if the controls' height can't be measured yet
 * (≥ the real styled height ~186px so we never under-reserve). */
const CONTROLS_H = 224;

function fireKey(key: string): void {
  sfx.resume(); // pointer is a user gesture — unlock audio
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function makeButton(label: string, key: string, cls: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = `tc-btn ${cls}`;
  b.textContent = label;
  b.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      b.classList.add("tc-active");
      fireKey(key);
    },
    { passive: false },
  );
  const release = () => b.classList.remove("tc-active");
  b.addEventListener("pointerup", release);
  b.addEventListener("pointerleave", release);
  b.addEventListener("pointercancel", release);
  b.addEventListener("contextmenu", (e) => e.preventDefault());
  return b;
}

export class TouchControls {
  private root: HTMLElement;
  private ctxBar!: HTMLElement;
  /** The whole on-screen control overlay (d-pad + 확인/취소 + scene button row)
   * is for touch / narrow screens; desktop menus use in-canvas buttons instead. */
  private enabled: boolean;

  constructor(private renderer: Renderer) {
    this.enabled = TouchControls.shouldShow();
    this.root = document.createElement("div");
    this.root.id = "touch-controls";
    this.build();
    document.getElementById("app")?.appendChild(this.root);
    this.refresh();
    window.addEventListener("resize", () => {
      this.enabled = TouchControls.shouldShow();
      this.root.style.display = this.enabled ? "" : "none";
      this.applyInset();
      requestAnimationFrame(() => this.applyInset());
    });
  }

  static shouldShow(): boolean {
    const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
    return touch || window.innerWidth < 820;
  }

  private refresh(): void {
    this.root.style.display = this.enabled ? "" : "none";
    this.applyInset();
  }

  /** Reserve exactly the controls' rendered height (grows if the ctx row wraps). */
  private applyInset(): void {
    this.renderer.uiInsetBottom = this.enabled ? this.root.offsetHeight || CONTROLS_H : 0;
  }

  private build(): void {
    this.ctxBar = document.createElement("div");
    this.ctxBar.className = "tc-ctx";
    this.root.appendChild(this.ctxBar);

    const main = document.createElement("div");
    main.className = "tc-main";

    const dpad = document.createElement("div");
    dpad.className = "tc-dpad";
    dpad.appendChild(makeButton("▲", "ArrowUp", "tc-up"));
    dpad.appendChild(makeButton("◀", "ArrowLeft", "tc-left"));
    dpad.appendChild(makeButton("▶", "ArrowRight", "tc-right"));
    dpad.appendChild(makeButton("▼", "ArrowDown", "tc-down"));
    main.appendChild(dpad);

    const act = document.createElement("div");
    act.className = "tc-act";
    act.appendChild(makeButton("확인", "Enter", "tc-a"));
    act.appendChild(makeButton("취소", "Escape", "tc-b"));
    main.appendChild(act);

    this.root.appendChild(main);
  }

  /** Update the scene-specific button row (called on scene change). */
  setContext(buttons: TouchButton[]): void {
    this.ctxBar.replaceChildren();
    for (const b of buttons) this.ctxBar.appendChild(makeButton(b.label, b.key, "tc-ctxbtn"));
    // The ctx row may wrap to 2 lines; reserve the new height (next frame, post-layout).
    this.applyInset();
    requestAnimationFrame(() => this.applyInset());
  }
}
