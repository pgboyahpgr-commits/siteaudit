import { scoreColor } from "../theme.js";

const C = 2 * Math.PI * 62;

export default function ScoreRing({ score }) {
  const color = scoreColor(score);
  const pct = score == null ? 0 : score;
  const offset = C - (pct / 100) * C;
  return (
    <div className="score-ring">
      <svg width="150" height="150" viewBox="0 0 150 150">
        <circle className="track" cx="75" cy="75" r="62" />
        <circle
          className="arc"
          cx="75"
          cy="75"
          r="62"
          stroke={color}
          strokeDasharray={C}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="val">
        <div>
          <b style={{ color }}>{score == null ? "--" : score}</b>
          <span>SECURITY SCORE</span>
        </div>
      </div>
    </div>
  );
}
