from __future__ import annotations

import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from model_utils import EMPLOYMENT_OPTIONS, EMPLOYMENT_RISK, engineer_features

BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = BASE_DIR / 'models'

NUMERIC_COLUMNS = ['income', 'creditScore', 'loanAmount', 'debtToIncomeRatio', 'loanToIncomeRatio']
CATEGORICAL_COLUMNS = ['employment']


def generate_training_data(sample_count: int = 1500) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    rows = []

    for _ in range(sample_count):
      income = float(rng.uniform(25000, 220000))
      credit_score = float(rng.integers(300, 851))
      loan_amount = float(rng.uniform(5000, min(income * 0.9, 120000)))
      employment = rng.choice(EMPLOYMENT_OPTIONS, p=[0.55, 0.2, 0.15, 0.1])
      engineered = engineer_features({
          'income': income,
          'creditScore': credit_score,
          'loanAmount': loan_amount,
          'employment': employment,
      }).engineered

      risk_signal = (
          engineered['loanToIncomeRatio'] * 2.2
          + engineered['debtToIncomeRatio'] * 1.5
          + max(0.0, (700.0 - credit_score) / 300.0)
          + EMPLOYMENT_RISK[employment] * 0.9
          + rng.normal(0.0, 0.18)
      )
      probability = 1.0 / (1.0 + np.exp(-(risk_signal - 1.2)))
      label = int(rng.random() < probability)
      rows.append({**engineered, 'fraudLabel': label})

    return pd.DataFrame(rows)


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ('numeric', StandardScaler(), NUMERIC_COLUMNS),
            ('employment', OneHotEncoder(handle_unknown='ignore'), CATEGORICAL_COLUMNS),
        ]
    )


def train_and_save_models(model_dir: Path | None = None) -> None:
    output_dir = model_dir or MODEL_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    training_data = generate_training_data()
    feature_columns = NUMERIC_COLUMNS + CATEGORICAL_COLUMNS
    x = training_data[feature_columns]
    y = training_data['fraudLabel']

    rf_pipeline = Pipeline(
        steps=[
            ('preprocessor', build_preprocessor()),
            ('classifier', RandomForestClassifier(n_estimators=240, max_depth=12, random_state=42, class_weight='balanced')),
        ]
    )

    logreg_pipeline = Pipeline(
        steps=[
            ('preprocessor', build_preprocessor()),
            ('classifier', LogisticRegression(max_iter=2000, class_weight='balanced')),
        ]
    )

    rf_pipeline.fit(x, y)
    logreg_pipeline.fit(x, y)

    joblib.dump(rf_pipeline, output_dir / 'random_forest.pkl')
    joblib.dump(logreg_pipeline, output_dir / 'logistic_regression.pkl')


if __name__ == '__main__':
    train_and_save_models()
