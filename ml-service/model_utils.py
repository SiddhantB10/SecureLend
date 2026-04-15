from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd

LOAN_TYPES = ['personal', 'property']
EMPLOYMENT_OPTIONS = ['stable', 'moderate', 'unstable', 'na']
EMPLOYMENT_RISK = {
    'stable': 0.2,
    'moderate': 0.5,
    'unstable': 0.8,
    'na': 0.0,
}


@dataclass(frozen=True)
class FeatureFrame:
    frame: pd.DataFrame
    engineered: dict[str, float]


def clamp_score(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def normalize_loan_type(value: str) -> str:
    normalized = (value or 'personal').strip().lower()
    return normalized if normalized in LOAN_TYPES else 'personal'


def normalize_employment(value: str) -> str:
    normalized = (value or 'stable').strip().lower().replace(' ', '_')
    return normalized if normalized in EMPLOYMENT_OPTIONS else 'stable'


def engineer_features(payload: dict[str, Any]) -> FeatureFrame:
    income = max(float(payload.get('income', 0) or 0), 1.0)
    credit_score = float(payload.get('creditScore', 300) or 300)
    loan_amount = max(float(payload.get('loanAmount', 0) or 0), 1.0)
    loan_type = normalize_loan_type(str(payload.get('loanType', 'personal')))
    existing_debt = max(float(payload.get('existingDebt', 0) or 0), 0.0)
    property_value = max(float(payload.get('propertyValue', 0) or 0), 1.0)
    employment = normalize_employment(str(payload.get('employmentStatus', payload.get('employment', 'stable'))))

    debt_to_income_ratio = existing_debt / income
    credit_risk_factor = 1 - (credit_score / 900.0)
    loan_to_income_ratio = loan_amount / income
    loan_to_value_ratio = loan_amount / property_value if loan_type == 'property' else 0.0
    employment_risk_factor = EMPLOYMENT_RISK[employment] if loan_type == 'personal' else 0.0

    if loan_type == 'personal':
        formula_score = (
            0.35 * debt_to_income_ratio
            + 0.30 * loan_to_income_ratio
            + 0.20 * credit_risk_factor
            + 0.15 * employment_risk_factor
        )
    else:
        formula_score = (
            0.40 * loan_to_value_ratio
            + 0.30 * debt_to_income_ratio
            + 0.20 * credit_risk_factor
            + 0.10 * (1 - credit_score / 900.0)
        )

    formula_score = clamp_score(formula_score)

    frame = pd.DataFrame(
        [
            {
                'loanType': loan_type,
                'income': income,
                'creditScore': credit_score,
                'loanAmount': loan_amount,
                'existingDebt': existing_debt,
                'propertyValue': property_value if loan_type == 'property' else 0.0,
                'employmentStatus': employment if loan_type == 'personal' else 'na',
                'debtToIncomeRatio': debt_to_income_ratio,
                'loanToIncomeRatio': loan_to_income_ratio,
                'loanToValueRatio': loan_to_value_ratio,
                'creditRiskFactor': credit_risk_factor,
                'employmentRiskFactor': employment_risk_factor,
                'formulaScore': formula_score,
            }
        ]
    )

    return FeatureFrame(
        frame=frame,
        engineered={
            'loanType': loan_type,
            'income': income,
            'creditScore': credit_score,
            'loanAmount': loan_amount,
            'existingDebt': existing_debt,
            'propertyValue': property_value,
            'employmentStatus': employment,
            'debtToIncomeRatio': round(debt_to_income_ratio, 4),
            'loanToIncomeRatio': round(loan_to_income_ratio, 4),
            'loanToValueRatio': round(loan_to_value_ratio, 4),
            'creditRiskFactor': round(credit_risk_factor, 4),
            'employmentRiskFactor': round(employment_risk_factor, 4),
            'formulaScore': round(formula_score, 4),
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
        markers.append('Low credit score')
    if engineered['loanToIncomeRatio'] > 0.45:
        markers.append('High loan-to-income ratio')
    if engineered['debtToIncomeRatio'] > 0.35:
        markers.append('High debt-to-income ratio')
    if engineered['loanType'] == 'property' and engineered['loanToValueRatio'] > 0.8:
        markers.append('High loan-to-value ratio')
    if engineered['loanType'] == 'personal' and engineered['employmentStatus'] == 'unstable':
        markers.append('Unstable employment profile')

    reason_text = '; '.join(markers) if markers else 'the application is within normal risk tolerance'
    return (
        f"The model assigned an ML score of {risk_score:.3f} because {reason_text}. "
        f"The strongest model drivers were {major_features}."
    )
