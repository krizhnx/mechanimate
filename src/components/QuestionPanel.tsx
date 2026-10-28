import { useState } from "react";
import { fmt } from "../shared/physics";
import type { SceneSpec } from "../shared/types";

export function QuestionPanel({ spec, imageUrl }: { spec: SceneSpec; imageUrl?: string }) {
  const [view, setView] = useState<"image" | "text">(imageUrl ? "image" : "text");
  return (
    <div>
      <div className="section-title" style={{ marginTop: 0 }}>
        Source
        {imageUrl && (
          <div className="seg">
            <button className={view === "image" ? "on" : ""} onClick={() => setView("image")}>
              Image
            </button>
            <button className={view === "text" ? "on" : ""} onClick={() => setView("text")}>
              Text
            </button>
          </div>
        )}
      </div>
      {imageUrl && view === "image" ? (
        <a className="q-image" href={imageUrl} target="_blank" rel="noreferrer" style={{ display: "block" }}>
          <img src={imageUrl} alt="Uploaded question" />
        </a>
      ) : (
        <p className="q-text">{spec.questionText}</p>
      )}

      {spec.givens.length > 0 && (
        <>
          <div className="section-title">Values Gemma extracted</div>
          <div className="givens">
            {spec.givens.map((g, i) => (
              <div key={i} className="given">
                <span className="sym">{g.symbol}</span>
                <span className="val">
                  {fmt(g.value)} <span className="faint">{g.unit}</span>
                </span>
                <span className="muted">{g.label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {spec.assumptions && spec.assumptions.length > 0 && (
        <>
          <div className="section-title">Modelling assumptions</div>
          <div className="chips">
            {spec.assumptions.map((a) => (
              <span key={a} className="chip">
                {a}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
