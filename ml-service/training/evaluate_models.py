"""Reproducible evaluation of SecureLend's credit-risk model (results used in the project report).

Everything here is computed from the real Lending Club data in data/ with the same
out-of-time split as train_model.py: models are trained on loans issued before
Sept 2011 and tested on the newest 20% of loans (Sept-Dec 2011).

Compared models
  1. Always approve      - naive baseline: predicts "repays" for everyone
  2. Rule-based          - counts policy red flags (low score, high EMI burden, missed payments,
                           many recent applications); no learning
  3. Logistic Regression - calibrated
  4. Random Forest       - calibrated; the configuration first proposed for this project
                           (240 trees, max depth 12, balanced class weights)
  5. Gradient Boosting   - calibrated, monotonic constraints (the production model)

Outputs (ml-service/reports/)
  evaluation.json            all numbers quoted in the report
  fig_model_comparison.png   ROC-AUC / PR-AUC / KS per model
  fig_roc_curves.png         ROC curves
  fig_confusion_matrix.png   production model at the decline threshold
  fig_calibration.png        predicted vs actual default rate by decile
  fig_risk_bands.png         actual default rate per risk band
  fig_feature_importance.png permutation importance (drop in ROC-AUC)
  fig_decision_outcomes.png  share of applicants and default rate per automatic decision

Run:  pip install -r requirements-dev.txt && python training/evaluate_models.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.calibration import CalibratedClassifierCV  # noqa: E402
from sklearn.ensemble import RandomForestClassifier  # noqa: E402
from sklearn.inspection import permutation_importance  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.pipeline import Pipeline  # noqa: E402

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from model_utils import FEATURE_LABELS, FULL_CATEGORICAL, FULL_NUMERIC, features_from_lending_club  # noqa: E402
from training.train_model import DATA_PATH, RISK_BANDS, make_candidates, make_preprocessor  # noqa: E402

REPORT_DIR = BASE_DIR / 'reports'
DECLINE_PD = 0.22  # personal-loan decline threshold used by the backend decision engine
APPROVE_PD = 0.12  # personal-loan auto-approve threshold
RANDOM_STATE = 42

COLORS = {
    'Always approve': '#9ca3af',
    'Rule-based': '#f59e0b',
    'Logistic Regression': '#3b82f6',
    'Random Forest': '#10b981',
    'Gradient Boosting (proposed)': '#1e3a8a',
}

plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False})


def ks(y, p):
    fpr, tpr, _ = roc_curve(y, p)
    return float(np.max(tpr - fpr))


def rule_based_score(x: pd.DataFrame) -> np.ndarray:
    """Number of policy red flags; small tie-breaker on credit score so the score is not too coarse."""
    flags = (
        (x['credit_score'] < 680).astype(int)
        + (x['existing_debt_to_income'] > 25).astype(int)
        + (x['missed_payments_2y'] >= 1).astype(int)
        + (x['credit_applications_6m'] >= 3).astype(int)
        + (x['tenure_months'] >= 60).astype(int)
    )
    return flags.to_numpy() + (850 - x['credit_score'].to_numpy()) / 10000.0


def threshold_metrics(y, flagged):
    tn, fp, fn, tp = confusion_matrix(y, flagged, labels=[0, 1]).ravel()
    return {
        'accuracy': round(float(accuracy_score(y, flagged)), 4),
        'precision': round(float(precision_score(y, flagged, zero_division=0)), 4),
        'recall': round(float(recall_score(y, flagged, zero_division=0)), 4),
        'f1': round(float(f1_score(y, flagged, zero_division=0)), 4),
        'flaggedShare': round(float(np.mean(flagged)), 4),
        'confusion': {'tp': int(tp), 'fp': int(fp), 'fn': int(fn), 'tn': int(tn)},
    }


def main() -> dict:
    REPORT_DIR.mkdir(exist_ok=True)
    x_all, y_all, issue = features_from_lending_club(pd.read_csv(DATA_PATH))
    columns = FULL_NUMERIC + FULL_CATEGORICAL
    x_all = x_all[columns]
    cutoff = issue.quantile(0.8)
    train = issue < cutoff
    x_tr, y_tr, x_te, y_te = x_all[train], y_all[train], x_all[~train], y_all[~train].to_numpy()

    candidates = make_candidates(FULL_NUMERIC, FULL_CATEGORICAL)
    rf = Pipeline(
        [
            ('prep', make_preprocessor(FULL_NUMERIC, FULL_CATEGORICAL, scale=False)),
            ('model', RandomForestClassifier(n_estimators=240, max_depth=12, class_weight='balanced', n_jobs=-1, random_state=RANDOM_STATE)),
        ]
    )
    learned = {
        'Logistic Regression': candidates['logistic_regression'],
        'Random Forest': rf,
        'Gradient Boosting (proposed)': candidates['gradient_boosting'],
    }

    scores = {'Always approve': np.zeros(len(y_te)), 'Rule-based': rule_based_score(x_te)}
    fitted = {}
    for name, pipe in learned.items():
        model = CalibratedClassifierCV(pipe, method='sigmoid', cv=5).fit(x_tr, y_tr)
        fitted[name] = model
        scores[name] = model.predict_proba(x_te)[:, 1]
        print(f'{name}: ROC-AUC {roc_auc_score(y_te, scores[name]):.4f}')

    results = {}
    for name, s in scores.items():
        if name == 'Always approve':
            flagged = np.zeros(len(y_te), dtype=int)
            auc = 0.5
            row = {'rocAuc': 0.5, 'prAuc': round(float(y_te.mean()), 4), 'ks': 0.0, 'brier': None}
        else:
            if name == 'Rule-based':
                flagged = (s >= 2).astype(int)  # decline when 2 or more red flags
            else:
                flagged = (s >= DECLINE_PD).astype(int)
            auc = roc_auc_score(y_te, s)
            row = {
                'rocAuc': round(float(auc), 4),
                'prAuc': round(float(average_precision_score(y_te, s)), 4),
                'ks': round(ks(y_te, s), 4),
                'brier': round(float(brier_score_loss(y_te, s)), 4) if name != 'Rule-based' else None,
            }
        row['gini'] = round(2 * row['rocAuc'] - 1, 4)
        row.update(threshold_metrics(y_te, flagged))
        results[name] = row

    prod = 'Gradient Boosting (proposed)'
    p = scores[prod]

    # Three-way decision outcomes on the test set (model-only; policy and fraud rules not applied).
    outcome = np.where(p < APPROVE_PD, 'Auto-approve', np.where(p < DECLINE_PD, 'Manual review', 'Decline'))
    decisions = []
    for name in ['Auto-approve', 'Manual review', 'Decline']:
        mask = outcome == name
        decisions.append({'decision': name, 'share': round(float(mask.mean()), 4), 'defaultRate': round(float(y_te[mask].mean()), 4), 'loans': int(mask.sum())})

    bands = []
    for name, lo, hi in RISK_BANDS:
        mask = (p >= lo) & (p < hi)
        bands.append({'band': name, 'share': round(float(mask.mean()), 4), 'predicted': round(float(p[mask].mean()), 4) if mask.any() else None, 'actual': round(float(y_te[mask].mean()), 4) if mask.any() else None})

    deciles = pd.qcut(p, 10, labels=False, duplicates='drop')
    calibration = pd.DataFrame({'d': deciles, 'p': p, 'y': y_te}).groupby('d').agg(predicted=('p', 'mean'), actual=('y', 'mean')).reset_index()

    perm = permutation_importance(fitted[prod], x_te, y_te, scoring='roc_auc', n_repeats=10, random_state=RANDOM_STATE, n_jobs=-1)
    importance = sorted(
        [{'feature': c, 'label': FEATURE_LABELS[c], 'aucDrop': round(float(m), 4), 'std': round(float(sd), 4)} for c, m, sd in zip(columns, perm.importances_mean, perm.importances_std)],
        key=lambda r: r['aucDrop'],
        reverse=True,
    )

    report = {
        'dataset': {
            'name': 'Lending Club personal loans 2007-2011',
            'loans': int(len(y_all)),
            'defaultRate': round(float(y_all.mean()), 4),
            'trainLoans': int(train.sum()),
            'testLoans': int((~train).sum()),
            'testDefaultRate': round(float(y_te.mean()), 4),
            'testPeriodStart': cutoff.strftime('%Y-%m'),
        },
        'thresholds': {'approvePd': APPROVE_PD, 'declinePd': DECLINE_PD, 'ruleBasedDeclineFlags': 2},
        'models': results,
        'decisionOutcomes': decisions,
        'riskBands': bands,
        'calibrationByDecile': [{k: round(float(v), 4) for k, v in r.items()} for r in calibration.to_dict('records')],
        'permutationImportance': importance,
    }
    (REPORT_DIR / 'evaluation.json').write_text(json.dumps(report, indent=2))

    # ── Figures ──────────────────────────────────────────────────────────────
    names = [n for n in results if n != 'Always approve']

    fig, ax = plt.subplots(figsize=(8, 4))
    metrics = [('rocAuc', 'ROC-AUC'), ('prAuc', 'PR-AUC'), ('ks', 'KS statistic')]
    width = 0.8 / len(names)
    for i, n in enumerate(names):
        vals = [results[n][m] for m, _ in metrics]
        bars = ax.bar(np.arange(len(metrics)) + i * width - 0.4 + width / 2, vals, width, label=n, color=COLORS[n])
        for b, v in zip(bars, vals):
            ax.text(b.get_x() + b.get_width() / 2, v + 0.01, f'{v:.3f}', ha='center', fontsize=7.5)
    ax.set_xticks(range(len(metrics)), [m for _, m in metrics])
    ax.set_ylim(0, 0.85)
    ax.set_title('Model comparison on the out-of-time test set (8,682 newest loans)')
    ax.legend(frameon=False, fontsize=8, ncol=2)
    fig.tight_layout()
    fig.savefig(REPORT_DIR / 'fig_model_comparison.png', dpi=200)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(5.5, 5))
    for n in names:
        fpr, tpr, _ = roc_curve(y_te, scores[n])
        ax.plot(fpr, tpr, color=COLORS[n], lw=2 if 'proposed' in n else 1.4, label=f"{n} (AUC {results[n]['rocAuc']:.3f})")
    ax.plot([0, 1], [0, 1], ls='--', color='#9ca3af', lw=1, label='Random guess (AUC 0.500)')
    ax.set_xlabel('False positive rate (repaid loans flagged)')
    ax.set_ylabel('True positive rate (defaults caught)')
    ax.set_title('ROC curves, out-of-time test set')
    ax.legend(frameon=False, fontsize=8, loc='lower right')
    fig.tight_layout()
    fig.savefig(REPORT_DIR / 'fig_roc_curves.png', dpi=200)
    plt.close(fig)

    c = results[prod]['confusion']
    mat = np.array([[c['tp'], c['fn']], [c['fp'], c['tn']]])
    fig, ax = plt.subplots(figsize=(5, 4.2))
    ax.imshow(mat, cmap='Blues')
    for (i, j), v in np.ndenumerate(mat):
        ax.text(j, i, f'{v:,}', ha='center', va='center', fontsize=14, color='white' if v > mat.max() / 2 else '#111827')
    ax.set_xticks([0, 1], ['Predicted\ndefault (decline)', 'Predicted\nrepay'])
    ax.set_yticks([0, 1], ['Actual\ndefault', 'Actual\nrepaid'])
    ax.set_title(f'Confusion matrix, proposed model (decline if PD ≥ {DECLINE_PD:.2f})')
    for s in ax.spines.values():
        s.set_visible(False)
    fig.tight_layout()
    fig.savefig(REPORT_DIR / 'fig_confusion_matrix.png', dpi=200)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(5.5, 4.5))
    ax.plot(calibration['predicted'], calibration['actual'], 'o-', color=COLORS[prod], label='Proposed model (deciles)')
    lim = max(calibration['predicted'].max(), calibration['actual'].max()) * 1.1
    ax.plot([0, lim], [0, lim], ls='--', color='#9ca3af', label='Perfect calibration')
    ax.set_xlabel('Predicted default probability')
    ax.set_ylabel('Actual default rate')
    ax.set_title('Calibration on the out-of-time test set')
    ax.legend(frameon=False, fontsize=8)
    fig.tight_layout()
    fig.savefig(REPORT_DIR / 'fig_calibration.png', dpi=200)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(7, 3.8))
    labels = [b['band'] for b in bands]
    actual = [b['actual'] * 100 for b in bands]
    bars = ax.bar(labels, actual, color=['#059669', '#10b981', '#f59e0b', '#ea580c', '#dc2626'])
    for b, v, s in zip(bars, actual, bands):
        ax.text(b.get_x() + b.get_width() / 2, v + 0.6, f'{v:.1f}%\n({s["share"] * 100:.0f}% of loans)', ha='center', fontsize=8)
    ax.set_ylabel('Actual default rate (%)')
    ax.set_ylim(0, max(actual) * 1.3)
    ax.set_title('Actual default rate by predicted risk band (test set)')
    fig.tight_layout()
    fig.savefig(REPORT_DIR / 'fig_risk_bands.png', dpi=200)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(7, 3.8))
    imp = importance[::-1]
    ax.barh([r['label'] for r in imp], [r['aucDrop'] for r in imp], xerr=[r['std'] for r in imp], color=COLORS[prod])
    ax.set_xlabel('Drop in ROC-AUC when the feature is shuffled')
    ax.set_title('Permutation feature importance, proposed model')
    fig.tight_layout()
    fig.savefig(REPORT_DIR / 'fig_feature_importance.png', dpi=200)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(7, 3.6))
    dl = [d['decision'] for d in decisions]
    share = [d['share'] * 100 for d in decisions]
    bars = ax.bar(dl, share, color=['#10b981', '#f59e0b', '#dc2626'])
    for b, d in zip(bars, decisions):
        ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 1, f"{d['share'] * 100:.1f}% of applicants\n{d['defaultRate'] * 100:.1f}% defaulted", ha='center', fontsize=8.5)
    ax.set_ylabel('Share of test applicants (%)')
    ax.set_ylim(0, max(share) * 1.35)
    ax.set_title('Automatic decisions by the risk model on the test set')
    fig.tight_layout()
    fig.savefig(REPORT_DIR / 'fig_decision_outcomes.png', dpi=200)
    plt.close(fig)

    print(json.dumps({n: {k: v for k, v in r.items() if k != 'confusion'} for n, r in results.items()}, indent=1))
    print(json.dumps(decisions), json.dumps(bands))
    print(json.dumps(importance[:9]))
    return report


if __name__ == '__main__':
    main()
