import { Renderer } from "../render/renderer";
import { loadMeta, saveMeta } from "../meta/save";
import type { MetaState } from "../core/types";
import { TitleScene } from "../ui/scenes";
import { sfx } from "../audio/sfx";
import { TouchControls, type TouchButton } from "../ui/touch";

export interface Scene {
  enter?(): void;
  update?(dt: number): void;
  render(r: Renderer): void;
  handleKey(e: KeyboardEvent): void;
  /** Left-click at CSS-px (x,y) relative to the canvas — for clickable menu UI. */
  handleClick?(x: number, y: number): void;
  /** Scene-specific on-screen touch buttons (label + key to dispatch). */
  touchBar?(): TouchButton[];
  exit?(): void;
}

/** Top-level orchestrator: owns the renderer, meta state, scene, and rAF loop. */
export class Game {
  readonly renderer: Renderer;
  meta: MetaState;
  private scene: Scene;
  private touch: TouchControls;
  private last = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.meta = loadMeta();
    this.touch = new TouchControls(this.renderer);
    this.scene = new TitleScene(this);
    this.scene.enter?.();
    this.touch.setContext(this.scene.touchBar?.() ?? []);

    window.addEventListener("keydown", this.onKey);
    window.addEventListener("resize", () => this.renderer.resize());

    // Pointer → UI hover + click (menus draw clickable buttons in-canvas).
    const cv = this.renderer.canvas;
    cv.addEventListener("pointermove", (e) => {
      const rect = cv.getBoundingClientRect();
      this.renderer.mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    });
    cv.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      sfx.resume();
      const rect = cv.getBoundingClientRect();
      this.scene.handleClick?.(e.clientX - rect.left, e.clientY - rect.top);
    });
    cv.addEventListener("pointerleave", () => {
      this.renderer.mouse = { x: -1, y: -1 };
    });

    requestAnimationFrame(this.frame);
  }

  setScene(scene: Scene): void {
    this.scene.exit?.();
    this.scene = scene;
    this.scene.enter?.();
    this.touch.setContext(this.scene.touchBar?.() ?? []);
  }

  persist(): void {
    saveMeta(this.meta);
  }

  private onKey = (e: KeyboardEvent): void => {
    sfx.resume(); // first user gesture unlocks audio
    // Prevent arrows/space from scrolling the page.
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"].includes(e.key)
    ) {
      e.preventDefault();
    }
    this.scene.handleKey(e);
  };

  private frame = (t: number): void => {
    const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0;
    this.last = t;
    this.renderer.tickClock(dt);
    this.scene.update?.(dt);
    this.scene.render(this.renderer);
    requestAnimationFrame(this.frame);
  };
}
