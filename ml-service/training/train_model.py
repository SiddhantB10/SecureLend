"""Train SecureLend's credit-risk (probability of default) models on real loan outcomes.

Data: Lending Club personal loans issued 2007-2011 (42.5k loans, each with a final
"Fully Paid" / "Charged Off" outcome and the borrower's FICO score at application).
See data/README.md for provenance.

What this script does
1. Builds currency-free features (see model_utils.py).
2. Holds out the most recent 20% of loans (by issue date) as an out-of-time test set,
   which is how a lender would validate a model before using it on future applicants.
3. Compares logistic regression and monotonic gradient boosting with 5-fold CV.
4. Calibrates the winner so scores are true default probabilities.
5. Reports AUC, Gini, KS, PR-AUC, Brier score, calibration and default rate per risk band.
6. Refits on all data and saves the models, an anomaly detector, a reference borrower
   profile for explanations, and a JSON scorecard the backend can use if this service is down.

Run:  python training/train_model.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    log_loss,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from model_utils import (  # noqa: E402
    BORROWER_CATEGORICAL,
    BORROWER_NUMERIC,
    FULL_CATEGORICAL,
    FULL_NUMERIC,
    MONOTONIC,
    PURPOSES,
    RESIDENCE_TYPES,
    features_from_lending_club,
)

DATA_PATH = BASE_DIR / 'data' / 'lending_club_2007_2011.csv.gz'
MODEL_DIR = BASE_DIR / 'models'
BACKEND_SCORECARD_PATH = BASE_DIR.parent / 'backend' / 'ml' / 'scorecard.json'
RANDOM_STATE = 42

# Probability-of-default bands used by the decision engine (kept in sync with backend).
RISK_BANDS = [
    ('Very low', 0.0, 0.07),
    ('Low', 0.07, 0.12),
    ('Medium', 0.12, 0.20),
    ('High', 0.20, 0.30),
    ('Very high', 0.30, 1.01),
]

CATEGORIES = {'residence': RESIDENCE_TYPES, 'purpose': PURPOSES}


def make_preprocessor(numeric: list[str], categorical: list[str], scale: bool) -> ColumnTransformer:
    numeric_steps = [('impute', SimpleImputer(strategy='median'))]
    if scale:
        numeric_steps.append(('scale', StandardScaler()))
    return ColumnTransformer(
        transformers=[
            ('num', Pipeline(numeric_steps), numeric),
            (
                'cat',
                OneHotEncoder(categories=[CATEGORIES[c] for c in categorical], handle_unknown='ignore'),
                categorical,
            ),
        ]
    )


def make_candidates(numeric: list[str], categorical: list[str]) -> dict[str, Pipeline]:
    n_cat_columns = sum(len(CATEGORIES[c]) for c in categorical)
    monotonic = [MONOTONIC[c] for c in numeric] + [0] * n_cat_columns
    return {
        'logistic_regression': Pipeline(
            [
                ('prep', make_preprocessor(numeric, categorical, scale=True)),
                ('model', LogisticRegression(max_iter=2000, C=1.0)),
            ]
        ),
        'gradient_boosting': Pipeline(
            [
                ('prep', make_preprocessor(numeric, categorical, scale=False)),
                (
                    'model',
                    HistGradientBoostingClassifier(
                        learning_rate=0.05,
                        max_iter=300,
                        max_leaf_nodes=15,
                        min_samples_leaf=80,
                        l2_regularization=1.0,
                        monotonic_cst=monotonic,
                        early_stopping=True,
                        validation_fraction=0.15,
                        random_state=RANDOM_STATE,
                    ),
                ),
            ]
        ),
    }


def ks_statistic(y_true: np.ndarray, scores: np.ndarray) -> float:
    fpr, tpr, _ = roc_curve(y_true, scores)
    return float(np.max(tpr - fpr))


def evaluate(y_true: np.ndarray, pd_scores: np.ndarray) -> dict:
    auc = roc_auc_score(y_true, pd_scores)
    deciles = pd.qcut(pd_scores, 10, labels=False, duplicates='drop')
    calibration = (
        pd.DataFrame({'decile': deciles, 'predicted': pd_scores, 'actual': y_true})
        .groupby('decile')
        .agg(predicted=('predicted', 'mean'), actual=('actual', 'mean'), loans=('actual', 'size'))
        .reset_index()
    )
    bands = []
    for name, low, high in RISK_BANDS:
        mask = (pd_scores >= low) & (pd_scores < high)
        bands.append(
            {
                'band': name,
                'pdRange': [low, min(high, 1.0)],
                'shareOfApplicants': round(float(mask.mean()), 4),
                'observedDefaultRate': round(float(y_true[mask].mean()), 4) if mask.any() else None,
            }
        )
    return {
        'rocAuc': round(float(auc), 4),
        'gini': round(float(2 * auc - 1), 4),
        'ks': round(ks_statistic(y_true, pd_scores), 4),
        'prAuc': round(float(average_precision_score(y_true, pd_scores)), 4),
        'brierScore': round(float(brier_score_loss(y_true, pd_scores)), 4),
        'logLoss': round(float(log_loss(y_true, pd_scores)), 4),
        'baseDefaultRate': round(float(y_true.mean()), 4),
        'meanPredictedPd': round(float(pd_scores.mean()), 4),
        'calibrationByDecile': [
            {k: (round(float(v), 4) if k != 'loans' else int(v)) for k, v in row.items()}
            for row in calibration.to_dict('records')
        ],
        'riskBands': bands,
    }


def export_scorecard(pipeline: Pipeline, numeric: list[str], categorical: list[str]) -> dict:
    """Export a fitted logistic-regression pipeline as plain numbers (for the JS fallback)."""
    prep = pipeline.named_steps['prep']
    num_pipe = prep.named_transformers_['num']
    coef = pipeline.named_steps['model'].coef_[0]
    n_num = len(numeric)
    card = {
        'intercept': float(pipeline.named_steps['model'].intercept_[0]),
        'numeric': [
            {
                'name': name,
                'median': float(num_pipe.named_steps['impute'].statistics_[i]),
                'mean': float(num_pipe.named_steps['scale'].mean_[i]),
                'scale': float(num_pipe.named_steps['scale'].scale_[i]),
                'coef': float(coef[i]),
            }
            for i, name in enumerate(numeric)
        ],
        'categorical': {},
    }
    offset = n_num
    for name in categorical:
        values = CATEGORIES[name]
        card['categorical'][name] = {v: float(coef[offset + j]) for j, v in enumerate(values)}
        offset += len(values)
    return card


def train_variant(name: str, x: pd.DataFrame, y: pd.Series, issue: pd.Series, numeric: list[str], categorical: list[str]) -> dict:
    columns = numeric + categorical
    x = x[columns]

    # Out-of-time split: newest 20% of loans are the test set.
    cutoff = issue.quantile(0.8)
    train_mask = issue < cutoff
    x_train, y_train = x[train_mask], y[train_mask]
    x_test, y_test = x[~train_mask], y[~train_mask]

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    comparison = {}
    for cand_name, pipeline in make_candidates(numeric, categorical).items():
        scores = cross_val_score(pipeline, x_train, y_train, cv=cv, scoring='roc_auc', n_jobs=-1)
        comparison[cand_name] = {'cvRocAucMean': round(float(scores.mean()), 4), 'cvRocAucStd': round(float(scores.std()), 4)}
        print(f'[{name}] {cand_name}: CV ROC-AUC {scores.mean():.4f} ± {scores.std():.4f}')

    # Prefer the monotonic gradient-boosting model: it guarantees that risk moves in the
    # direction lenders expect (e.g. more missed payments never lowers risk), which keeps
    # explanations trustworthy. Logistic regression is only chosen if it is clearly better.
    best_name = 'gradient_boosting'
    if comparison['logistic_regression']['cvRocAucMean'] > comparison['gradient_boosting']['cvRocAucMean'] + 0.01:
        best_name = 'logistic_regression'
    print(f'[{name}] selected: {best_name}')

    def calibrated(model_name: str) -> CalibratedClassifierCV:
        # Sigmoid (Platt) calibration: smooth, so it never flattens scores at the extremes,
        # which keeps per-applicant explanations meaningful for very low/high risk cases.
        return CalibratedClassifierCV(make_candidates(numeric, categorical)[model_name], method='sigmoid', cv=5)

    # Out-of-time evaluation of every candidate (selection was done on CV only).
    for cand_name in comparison:
        model = calibrated(cand_name).fit(x_train, y_train)
        comparison[cand_name]['outOfTimeTest'] = evaluate(y_test.to_numpy(), model.predict_proba(x_test)[:, 1])
        print(f"[{name}] {cand_name}: out-of-time ROC-AUC {comparison[cand_name]['outOfTimeTest']['rocAuc']}")

    # Final production model: same recipe, fitted on all loans.
    final_model = calibrated(best_name).fit(x, y)

    # Plain logistic scorecard for the backend fallback. Standard scorecard practice:
    # drop any variable whose coefficient has a counter-intuitive sign, then refit.
    card_numeric = list(numeric)
    while True:
        scorecard_pipe = make_candidates(card_numeric, categorical)['logistic_regression'].fit(x[card_numeric + categorical], y)
        coefs = scorecard_pipe.named_steps['model'].coef_[0][: len(card_numeric)]
        wrong = [f for f, c in zip(card_numeric, coefs) if np.sign(c) != MONOTONIC[f]]
        if not wrong:
            break
        print(f'[{name}] scorecard: dropping counter-intuitive {wrong}')
        card_numeric = [f for f in card_numeric if f not in wrong]

    # Reference borrower (median of loans that were repaid) for per-applicant explanations.
    repaid = x[y == 0]
    reference = {c: float(repaid[c].median()) for c in numeric}
    reference.update({c: str(repaid[c].mode().iloc[0]) for c in categorical})

    return {
        'model': final_model,
        'scorecard': export_scorecard(scorecard_pipe, card_numeric, categorical),
        'reference': reference,
        'report': {
            'selectedModel': best_name,
            'features': columns,
            'trainLoans': int(train_mask.sum()),
            'testLoans': int((~train_mask).sum()),
            'testPeriodStart': cutoff.strftime('%Y-%m'),
            'candidates': comparison,
            'test': comparison[best_name]['outOfTimeTest'],
        },
    }


def train_and_save_models(model_dir: Path | None = None) -> dict:
    output_dir = model_dir or MODEL_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(DATA_PATH)
    x, y, issue = features_from_lending_club(raw)
    print(f'Loaded {len(x)} loans, default rate {y.mean():.3f}, issued {issue.min():%Y-%m} to {issue.max():%Y-%m}')

    full = train_variant('personal', x, y, issue, FULL_NUMERIC, FULL_CATEGORICAL)
    borrower = train_variant('property', x, y, issue, BORROWER_NUMERIC, BORROWER_CATEGORICAL)

    # Anomaly detectors: flag applications whose combination of values is unlike any of the
    # 42k real borrowers (top 1% most unusual). Used to route cases to manual verification.
    def anomaly_detector(columns: list[str]) -> dict:
        pipeline = Pipeline(
            [
                ('impute', SimpleImputer(strategy='median')),
                ('scale', StandardScaler()),
                ('iso', IsolationForest(n_estimators=150, contamination=0.01, random_state=RANDOM_STATE)),
            ]
        ).fit(x[columns])
        return {'pipeline': pipeline, 'columns': columns}

    joblib.dump(full['model'], output_dir / 'credit_risk_personal.pkl')
    joblib.dump(borrower['model'], output_dir / 'credit_risk_property.pkl')
    joblib.dump(
        {'personal': anomaly_detector(FULL_NUMERIC), 'property': anomaly_detector(BORROWER_NUMERIC)},
        output_dir / 'anomaly_detector.pkl',
    )

    version = datetime.now(timezone.utc).strftime('%Y%m%d')
    metrics = {
        'modelVersion': f'lc-pd-{version}',
        'trainedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'dataset': {
            'name': 'Lending Club personal loans 2007-2011',
            'loans': int(len(x)),
            'defaultRate': round(float(y.mean()), 4),
            'target': 'Charged Off (defaulted) vs Fully Paid',
            'issuedFrom': issue.min().strftime('%Y-%m'),
            'issuedTo': issue.max().strftime('%Y-%m'),
        },
        'riskBands': [{'band': n, 'min': lo, 'max': min(hi, 1.0)} for n, lo, hi in RISK_BANDS],
        'personal': full['report'],
        'property': borrower['report'],
    }
    (output_dir / 'metrics.json').write_text(json.dumps(metrics, indent=2))
    (output_dir / 'reference_profiles.json').write_text(
        json.dumps({'personal': full['reference'], 'property': borrower['reference']}, indent=2)
    )

    scorecard = {
        'modelVersion': metrics['modelVersion'] + '-scorecard',
        'note': 'Logistic-regression fallback used by the backend only when the ML service is unreachable.',
        'personal': full['scorecard'],
        'property': borrower['scorecard'],
    }
    (output_dir / 'scorecard.json').write_text(json.dumps(scorecard, indent=2))
    # Keep the backend's fallback scorecard in sync when the repo layout is present.
    if BACKEND_SCORECARD_PATH.parent.parent.exists():
        BACKEND_SCORECARD_PATH.parent.mkdir(parents=True, exist_ok=True)
        BACKEND_SCORECARD_PATH.write_text(json.dumps(scorecard, indent=2))

    print(json.dumps({k: metrics[k]['test'] for k in ('personal', 'property')}, indent=2)[:3000])
    return metrics


if __name__ == '__main__':
    train_and_save_models()
