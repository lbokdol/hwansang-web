import "./style.css";
import { Game } from "./game/game";
import { registerAllHellTiles } from "./content/hells";
import { loadSprites } from "./render/sprites";

// Register every hell's hazard tiles before any floor is generated.
registerAllHellTiles();
// Kick off sprite loading (async; rendering falls back to glyphs until ready).
loadSprites();

const canvas = document.getElementById("game") as HTMLCanvasElement;
new Game(canvas);
