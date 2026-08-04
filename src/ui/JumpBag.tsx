import { useGameStore } from "../state/gameStore";

const GRID_SLOTS = 8;

/** The diegetic jump-bag inventory: a small fixed grid, toggled with Tab. */
export function JumpBag() {
  const open = useGameStore((s) => s.bagOpen);
  const inventory = useGameStore((s) => s.inventory);
  if (!open) return null;

  const slots = Array.from({ length: GRID_SLOTS }, (_, i) => inventory[i] ?? null);

  return (
    <div className="bag-overlay">
      <div className="bag-panel">
        <div className="bag-title">JUMP BAG</div>
        <div className="bag-grid">
          {slots.map((item, i) => (
            <div key={i} className={item ? "bag-slot filled" : "bag-slot"}>
              {item && (
                <>
                  <div className="bag-item-name">{item.name}</div>
                  <div className="bag-item-desc">{item.description}</div>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="pcr-hint">[Tab] close</div>
      </div>
    </div>
  );
}
