# -*- coding: utf-8 -*-
"""
Exhaustive sensitivity analysis of the REBA score with respect to
(1) the wrist component (omitted in REBAPose: fixed at its minimum score of 1), and
(2) the manually assigned load/force, coupling, and activity factors.

REBA structure (Hignett & McAtamney, 2000, Applied Ergonomics 31:201-205):
    Score A = Table A(neck, trunk, legs) + load/force  (load 0-3, incl. +1 shock)
    Score B = Table B(upper arm, lower arm, wrist) + coupling  (coupling 0-3)
    REBA    = Table C(Score A, Score B) + activity  (activity 0-3)

Because REBA is a finite lookup-table system, the effect of any input
perturbation can be enumerated exactly. This script enumerates the complete
input space (3 neck x 5 trunk x 4 legs x 4 load x 6 upper arm x 2 lower arm
x 4 coupling x 4 activity = 46,080 states per scenario) and reports the
distribution of the resulting change in the final REBA score and in the
REBA action level.

The scoring tables below are validated against the worked example in the
original publication (see validate_tables_against_paper_example()).

Usage:  python reba_sensitivity_analysis.py
Requires: numpy
"""

import itertools
import numpy as np

# ----------------------------------------------------------------------------
# REBA lookup tables (Hignett & McAtamney, 2000)
# ----------------------------------------------------------------------------

# Table A, indexed [neck-1][trunk-1][legs-1]; neck 1-3, trunk 1-5, legs 1-4
TABLE_A = np.array([
    [[1, 2, 3, 4], [2, 3, 4, 5], [2, 4, 5, 6], [3, 5, 6, 7], [4, 6, 7, 8]],
    [[1, 2, 3, 4], [3, 4, 5, 6], [4, 5, 6, 7], [5, 6, 7, 8], [6, 7, 8, 9]],
    [[3, 3, 5, 6], [4, 5, 6, 7], [5, 6, 7, 8], [6, 7, 8, 9], [7, 8, 9, 9]],
])

# Table B, indexed [upper_arm-1][lower_arm-1][wrist-1]; UA 1-6, LA 1-2, wrist 1-3
TABLE_B = np.array([
    [[1, 2, 2], [1, 2, 3]],
    [[1, 2, 3], [2, 3, 4]],
    [[3, 4, 5], [4, 5, 5]],
    [[4, 5, 5], [5, 6, 7]],
    [[6, 7, 8], [7, 8, 8]],
    [[7, 8, 8], [8, 9, 9]],
])

# Table C, indexed [score_a-1][score_b-1]; both 1-12 (values above 12 clamp to 12)
TABLE_C = np.array([
    [1, 1, 1, 2, 3, 3, 4, 5, 6, 7, 7, 7],
    [1, 2, 2, 3, 4, 4, 5, 6, 6, 7, 7, 8],
    [2, 3, 3, 3, 4, 5, 6, 7, 7, 8, 8, 8],
    [3, 4, 4, 4, 5, 6, 7, 8, 8, 9, 9, 9],
    [4, 4, 4, 5, 6, 7, 8, 8, 9, 9, 9, 9],
    [6, 6, 6, 7, 8, 8, 9, 9, 10, 10, 10, 10],
    [7, 7, 7, 8, 9, 9, 9, 10, 10, 11, 11, 11],
    [8, 8, 8, 9, 10, 10, 10, 10, 10, 11, 11, 11],
    [9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12],
    [10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 12],
    [11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12],
    [12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12],
])

NECKS, TRUNKS, LEGS = range(1, 4), range(1, 6), range(1, 5)
UAS, LAS = range(1, 7), range(1, 3)
LOADS, COUPLINGS, ACTIVITIES = range(0, 4), range(0, 4), range(0, 4)


def table_c(score_a, score_b):
    """Table C lookup with clamping at 12 (scores A/B can reach 12 via factors)."""
    return int(TABLE_C[min(score_a, 12) - 1][min(score_b, 12) - 1])


def action_level(reba):
    """REBA action levels (Hignett & McAtamney, 2000, Table 4).
    0: negligible (1); 1: low (2-3); 2: medium (4-7);
    3: high, necessary soon (8-10); 4: very high, necessary NOW (11-15)."""
    if reba == 1:
        return 0
    if reba <= 3:
        return 1
    if reba <= 7:
        return 2
    if reba <= 10:
        return 3
    return 4


def reba_score(neck, trunk, legs, load, ua, la, wrist, coupling, activity):
    score_a = int(TABLE_A[neck - 1][trunk - 1][legs - 1]) + load
    score_b = int(TABLE_B[ua - 1][la - 1][wrist - 1]) + coupling
    return table_c(score_a, score_b) + activity


def validate_tables_against_paper_example():
    """Worked example from Hignett & McAtamney (2000), p.205:
    Table B subtotal for UA=3, LA=2, wrist=1 must be 4; coupling +1 -> Score B = 5.
    Score A = 8; Table C(8, 5) must be 10; activity +1 -> REBA = 11 (action level 4)."""
    assert int(TABLE_B[3 - 1][2 - 1][1 - 1]) == 4, "Table B mismatch vs. paper example"
    assert table_c(8, 5) == 10, "Table C mismatch vs. paper example"
    assert action_level(10 + 1) == 4, "Action level mismatch vs. paper example"
    print("Table validation against Hignett & McAtamney (2000) worked example: PASSED\n")


def dist(values):
    """Return {delta: percentage} over a list of integer deltas."""
    values = np.asarray(values)
    return {int(k): round(float((values == k).mean() * 100), 1)
            for k in sorted(set(values.tolist()))}


def wrist_sensitivity():
    """REBAPose fixes wrist score = 1 (2D-to-3D lifting provides no wrist
    orientation). True wrist score is 1, 2, or 3, so the omission is one-sided:
    it can only underestimate Score B and the final REBA score."""
    print("=" * 72)
    print("(1) WRIST OMISSION (study: wrist fixed at score 1)")
    print("=" * 72)

    # Effect on Table B alone
    d2 = [int(TABLE_B[ua - 1][la - 1][1] - TABLE_B[ua - 1][la - 1][0])
          for ua in UAS for la in LAS]
    d3 = [int(TABLE_B[ua - 1][la - 1][2] - TABLE_B[ua - 1][la - 1][0])
          for ua in UAS for la in LAS]
    print(f"Table B increase, wrist 1->2: min {min(d2)}, max {max(d2)} (always +1)")
    print(f"Table B increase, wrist 1->3: min {min(d3)}, max {max(d3)} (mean {np.mean(d3):.2f})\n")

    for true_wrist in (2, 3):
        deltas, act_changed, deltas_hi, act_changed_hi = [], [], [], []
        n_states = 0
        for neck, trunk, legs, load, ua, la, coupling, activity in itertools.product(
                NECKS, TRUNKS, LEGS, LOADS, UAS, LAS, COUPLINGS, ACTIVITIES):
            n_states += 1
            r_true = reba_score(neck, trunk, legs, load, ua, la, true_wrist, coupling, activity)
            r_study = reba_score(neck, trunk, legs, load, ua, la, 1, coupling, activity)
            d = r_true - r_study
            changed = action_level(r_true) != action_level(r_study)
            deltas.append(d)
            act_changed.append(changed)
            if r_true >= 8:  # high-risk regime relevant to the demolition data
                deltas_hi.append(d)
                act_changed_hi.append(changed)
        print(f"True wrist score = {true_wrist}  ({n_states:,} enumerated states)")
        print(f"  Underestimation of final REBA (dREBA): {dist(deltas)}")
        print(f"  Action-level changes: {np.mean(act_changed) * 100:.1f}%")
        print(f"  Restricted to true REBA >= 8: dREBA {dist(deltas_hi)}; "
              f"action-level changes {np.mean(act_changed_hi) * 100:.1f}%\n")


def factor_sensitivity():
    """Impact of a full +1 misassignment of load, coupling, or activity,
    enumerated with wrist = 1 (as in the study). By symmetry of the additive
    factors, a -1 misassignment has the mirrored effect."""
    print("=" * 72)
    print("(2) LOAD / COUPLING / ACTIVITY MISASSIGNED BY A FULL UNIT (+1)")
    print("=" * 72)
    for factor in ("load", "coupling", "activity"):
        deltas, act_changed = [], []
        for neck, trunk, legs, load, ua, la, coupling, activity in itertools.product(
                NECKS, TRUNKS, LEGS, LOADS, UAS, LAS, COUPLINGS, ACTIVITIES):
            base = reba_score(neck, trunk, legs, load, ua, la, 1, coupling, activity)
            if factor == "load" and load < 3:
                pert = reba_score(neck, trunk, legs, load + 1, ua, la, 1, coupling, activity)
            elif factor == "coupling" and coupling < 3:
                pert = reba_score(neck, trunk, legs, load, ua, la, 1, coupling + 1, activity)
            elif factor == "activity" and activity < 3:
                pert = reba_score(neck, trunk, legs, load, ua, la, 1, coupling, activity + 1)
            else:
                continue
            deltas.append(pert - base)
            act_changed.append(action_level(pert) != action_level(base))
        print(f"{factor:9s} +1: dREBA {dist(deltas)}; "
              f"action-level changes {np.mean(act_changed) * 100:.1f}%")
    print()


def worked_examples():
    """Illustrative postures for the response document."""
    print("=" * 72)
    print("(3) WORKED EXAMPLES")
    print("=" * 72)
    print("DEM (core wrecking, jackhammer): neck=3, trunk=4, legs=2, load=2,")
    print("upper arm=4, lower arm=2, coupling=1, activity=2")
    for w in (1, 2, 3):
        a = int(TABLE_A[2][3][1]) + 2
        b = int(TABLE_B[3][1][w - 1]) + 1
        r = table_c(a, b) + 2
        print(f"  wrist={w}: Score A={a}, Score B={b}, Table C={table_c(a, b)}, "
              f"REBA={r}, action level={action_level(r)}")
    print("\nModerate posture: neck=2, trunk=3, legs=1, load=1,")
    print("upper arm=3, lower arm=1, coupling=0, activity=1")
    for w in (1, 2, 3):
        a = int(TABLE_A[1][2][0]) + 1
        b = int(TABLE_B[2][0][w - 1])
        r = table_c(a, b) + 1
        print(f"  wrist={w}: Score A={a}, Score B={b}, Table C={table_c(a, b)}, "
              f"REBA={r}, action level={action_level(r)}")
    print("\nNote: at high scores, Table C saturation absorbs most of the wrist")
    print("effect; at moderate scores the effect is larger but the direction is")
    print("still one-sided (underestimation only).")


def neck_rhi_sensitivity():
    """Robustness of the neck RHI (0.797) to neck-angle misclassification.

    RHI for a body region = (sum of its posture sub-scores W) / (A * N), with
    A = 3 for the neck and N = 2,802 postures. RHI is therefore LINEAR in the
    sub-scores: if a fraction p of postures carries a one-unit sub-score error,
    the RHI shifts by exactly p/3. This permits exact worst-case bounds using
    the SME angle-disagreement rates (SME1: 37.5%, SME2: 26.1%) under three
    deliberately conservative assumptions: (i) the 88-image disagreement rates
    transfer to all 2,802 postures; (ii) every disputed angle implies a full
    one-unit sub-score error (in reality the neck sub-score changes only when
    the angle crosses the 20-degree/extension bin boundary); and (iii) all
    errors point in the same direction, against the study's claim (over-
    scoring). Unbiased (two-sided) errors would leave the expected RHI
    unchanged."""
    print("=" * 72)
    print("(4) NECK RHI ROBUSTNESS TO ANGLE MISCLASSIFICATION")
    print("=" * 72)
    rhi = {"lower arm": 0.966, "neck": 0.797, "trunk": 0.522,
           "legs": 0.447, "upper arm": 0.420}
    print(f"Reported neck RHI = {rhi['neck']} -> mean neck sub-score "
          f"= {rhi['neck'] * 3:.3f} (scale 1-3)")
    print(f"Leverage of a single posture: 1/(3 x 2802) = {1 / (3 * 2802):.6f}\n")
    for p, label in [(0.375, "SME1 disagreement rate, 37.5%"),
                     (0.261, "SME2 disagreement rate, 26.1%")]:
        print(f"Worst case ({label}; all disputed angles assumed one-unit "
              f"over-scores): neck RHI >= {rhi['neck'] - p / 3:.3f}")
    print("-> even then the neck remains the second-highest RHI region, above")
    print(f"   trunk ({rhi['trunk']}), legs ({rhi['legs']}), and upper arm "
          f"({rhi['upper arm']}).\n")
    for part in ("trunk", "legs", "upper arm"):
        p = (rhi["neck"] - rhi[part]) * 3
        tag = "IMPOSSIBLE (>100%)" if p > 1 else f"{p * 100:.1f}% of all postures"
        print(f"Break-even vs {part} ({rhi[part]}): requires systematic one-unit "
              f"over-scoring in {tag}")
    print(f"Absolute floor (every posture over-scored by one unit): "
          f"{rhi['neck'] - 1 / 3:.3f} -- still above legs and upper arm.")


if __name__ == "__main__":
    validate_tables_against_paper_example()
    wrist_sensitivity()
    factor_sensitivity()
    worked_examples()
    neck_rhi_sensitivity()
