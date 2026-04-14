from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd

EMPLOYMENT_OPTIONS = ['employed', 'self_employed', 'contract', 'unemployed']
EMPLOYMENT_RISK = {
    'employed': 0.1,
    'self_employed': 0.28,
    'contract': 0.24,
    'unemployed': 0.52,
}


@dataclass(frozen=True)
class FeatureFrame:
    frame: pd.DataFrame
    engineered: dict[str, float]


def normalize_employment(value: str) -> str:
    normalized = (value or 'employed').strip().lower().replace(' ', '_')
    return normalized if normalized in EMPLOYMENT_OPTIONS else 'employed'


def engineer_features(payload: dict[str, Any]) -> FeatureFrame:
    income = max(float(payload.get('income', 0) or 0), 1.0)
    credit_score = float(payload.get('creditScore', 0) or 0)
    loan_amount = max(float(payload.get('loanAmount', 0) or 0), 1.0)
    employment = normalize_employment(str(payload.get('employment', 'employed')))

    loan_to_income_ratio = loan_amount / income
    employment_penalty = EMPLOYMENT_RISK[employment]
    credit_penalty = max(0.0, (740.0 - credit_score) / 400.0)
    debt_to_income_ratio = min((loan_amount * 0.18 + employment_penalty * 18000 + credit_penalty * 9000) / income, 6.0)

    frame = pd.DataFrame(
        [
            {
                'income': income,
                'creditScore': credit_score,
                'loanAmount': loan_amount,
                'employment': employment,
                'debtToIncomeRatio': debt_to_income_ratio,
                'loanToIncomeRatio': loan_to_income_ratio,
            }
        ]
    )

    return FeatureFrame(
        frame=frame,
        engineered={
            'income': income,
            'creditScore': credit_score,
            'loanAmount': loan_amount,
            'employment': employment,
            'debtToIncomeRatio': round(debt_to_income_ratio, 4),
            'loanToIncomeRatio': round(loan_to_income_ratio, 4),
        },
    )


def risk_category(risk_score: float) -> str:
    if risk_score < 0.3:
        return 'Low'
    if risk_score <= 0.7:
        return 'Medium'
    return 'High'


def top_feature_importances(feature_names: list[str], importances: list[float], limit: int = 5) -> list[dict[str, float | str]]:
    pairs = sorted(zip(feature_names, importances), key=lambda item: item[1], reverse=True)[:limit]
    return [
        {
            'feature': feature,
            'importance': round(float(score), 4),
        }
        for feature, score in pairs
    ]


def build_explanation(feature_importance: list[dict[str, float | str]], engineered: dict[str, float], risk_score: float) -> str:
    major_features = ', '.join(
        f"{item['feature']} ({item['importance']})" for item in feature_importance[:3]
    )
    markers = []

    if engineered['creditScore'] < 650:
        markers.append(f"credit score is {int(engineered['creditScore'])}")
    if engineered['loanToIncomeRatio'] > 0.45:
        markers.append(f"loan-to-income ratio is {engineered['loanToIncomeRatio']}")
    if engineered['debtToIncomeRatio'] > 0.35:
        markers.append(f"debt-to-income ratio is {engineered['debtToIncomeRatio']}")
    if engineered['employment'] in {'self_employed', 'contract', 'unemployed'}:
        markers.append(f"employment is classified as {engineered['employment'].replace('_', ' ')}")

    reason_text = '; '.join(markers) if markers else 'the application is within normal risk tolerance'
    return (
        f"The model assigned a risk score of {risk_score:.3f} because {reason_text}. "
        f"The strongest model drivers were {major_features}."
    )
