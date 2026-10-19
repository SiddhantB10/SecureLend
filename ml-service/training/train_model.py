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

# Add parent directory to path for imports
_current_dir = Path(__file__).resolve().parent
_parent_dir = _current_dir.parent
sys.path.insert(0, str(_parent_dir))

from model_utils import EMPLOYMENT_OPTIONS, EMPLOYMENT_RISK, engineer_features

BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = BASE_DIR / 'models'

NUMERIC_COLUMNS = [
    'income',
    'creditScore',
    'loanAmount',
    'existingDebt',
    'propertyValue',
    'debtToIncomeRatio',
    'loanToIncomeRatio',
    'loanToValueRatio',
    'creditRiskFactor',
    'employmentRiskFactor',
    'formulaScore',
]
CATEGORICAL_COLUMNS = ['loanType', 'employmentStatus']


def generate_training_data(sample_count: int = 1500) -> pd.DataFrame:
    rng = np.random.default_rng(42)
    rows = []

    for _ in range(sample_count):
        # India-centric annual income range in INR (approx 1.8L to 40L)
        income = float(rng.uniform(180000, 4000000))
        credit_score = float(rng.integers(300, 901))
        # India-centric loan ticket sizes in INR (0.5L up to 25L, bounded by income ratio)
        loan_amount = float(rng.uniform(50000, min(income * 1.2, 3000000)))
        loan_type = rng.choice(['personal', 'property'], p=[0.58, 0.42])
        employment = rng.choice(['stable', 'moderate', 'unstable'], p=[0.6, 0.28, 0.12])
        existing_debt = float(rng.uniform(0, income * 0.95))
        if loan_type == 'property':
            property_low = max(loan_amount * 0.8, 300000)
            property_high = max(property_low + 1, loan_amount * 2.4)
            property_value = float(rng.uniform(property_low, property_high))
        else:
            property_value = 0.0

        engineered = engineer_features({
            'loanType': loan_type,
            'income': income,
            'creditScore': credit_score,
            'loanAmount': loan_amount,
            'existingDebt': existing_debt,
            'propertyValue': property_value,
            'employmentStatus': employment,
        }).engineered

        employment_risk = EMPLOYMENT_RISK[engineered['employmentStatus']] if engineered['loanType'] == 'personal' else 0.0
        property_risk = engineered['loanToValueRatio'] * 1.6 if engineered['loanType'] == 'property' else 0.0

        risk_signal = (
            engineered['formulaScore'] * 2.1
            + engineered['debtToIncomeRatio'] * 1.3
            + engineered['loanToIncomeRatio'] * 0.6
            + property_risk
            + employment_risk * 0.9
            + max(0.0, (680.0 - credit_score) / 320.0)
            + rng.normal(0.0, 0.2)
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
