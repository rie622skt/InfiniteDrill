// 一時的な集計スクリプト: 曲げ応力度問題のパターン数を数える

const B_VALUES_MM = [80, 100, 120, 140, 150, 160, 180, 200];
const H_VALUES_MM = [160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360];

const SECTION_PAIRS = (() => {
  const pairs = [];
  for (const b of B_VALUES_MM) {
    for (const h of H_VALUES_MM) {
      const bh2 = b * h * h;
      const bh3 = b * h * h * h;
      if (bh2 % 6 === 0 && bh3 % 12 === 0) pairs.push([b, h]);
    }
  }
  return pairs;
})();

const SIMPLE_L_VALUES_M = [4, 6, 8];
const CANTILEVER_L_VALUES_M = [3, 4, 5];
const P_VALUES_KN = [10, 20, 24, 30, 40, 48, 60];

function collectBendingStressCandidates() {
  const out = [];

  for (const [bmm, hmm] of SECTION_PAIRS) {
    const Z = (bmm * hmm * hmm) / 6;

    // cantilever: Mmax = P * L
    for (const L of CANTILEVER_L_VALUES_M) {
      for (const P of P_VALUES_KN) {
        const Mmax = P * L;
        const M_nmm = Mmax * 1_000_000;
        if (M_nmm % Z !== 0) continue;
        const sigma = M_nmm / Z;
        out.push({
          type: "cantilever",
          L,
          P,
          Mmax,
          bmm,
          hmm,
          Z,
          sigma,
        });
      }
    }

    // simple: Mmax = P * L / 4
    for (const L of SIMPLE_L_VALUES_M) {
      for (const P of P_VALUES_KN) {
        const Mmax = (P * L) / 4;
        const M_nmm = Mmax * 1_000_000;
        if (M_nmm % Z !== 0) continue;
        const sigma = M_nmm / Z;
        out.push({
          type: "simple",
          L,
          P,
          Mmax,
          bmm,
          hmm,
          Z,
          sigma,
        });
      }
    }
  }

  return out;
}

const pairsCount = SECTION_PAIRS.length;
const candidates = collectBendingStressCandidates();
const simpleCount = candidates.filter((c) => c.type === "simple").length;
const cantileverCount = candidates.filter((c) => c.type === "cantilever").length;

console.log("SECTION_PAIRS (b,h) count:", pairsCount);
console.log("Bending stress candidates total:", candidates.length);
console.log("  simple:", simpleCount);
console.log("  cantilever:", cantileverCount);

