"""Shared feature engineering for SecureLend's credit-risk models.

The same functions are used at training time (on the Lending Club dataset) and at
prediction time (on an application submitted through the website), so the model
always sees features computed the same way.

All model features are *currency-free* (ratios, counts, years, a credit score on the
FICO scale), which is what lets a model trained on US loan outcomes be applied to
applications entered in INR.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

# ─── Feature definitions ─────────────────────────────────────────────────────

RESIDENCE_TYPES = ['rented', 'owned', 'owned_mortgage', 'family']
PURPOSES = [
    'debt_consolidation',
    'home_renovation',
    'medical',
    'wedding',
    'education',
    'vehicle',
    'business',
    'travel',
    'major_purchase',
    'other',
]

# Personal-loan model: credit behaviour + loan terms (tenure, purpose).
# Loan-size ratios (loan/income, EMI/income) are deliberately NOT model inputs: Lending Club
# loans were small relative to income (median 0.16x annual income), so a typical Indian
# personal loan would look extreme to the model. Affordability is instead judged by the
# FOIR rule (all EMIs incl. the new one / net income), which is how Indian lenders decide it.
# This costs only ~0.008 out-of-time AUC (0.698 -> 0.690) and removes a large dataset bias.
FULL_NUMERIC = [
    'credit_score',
    'existing_debt_to_income',
    'tenure_months',
    'years_employed',
    'missed_payments_2y',
    'credit_applications_6m',
    'credit_history_years',
]
FULL_CATEGORICAL = ['residence', 'purpose']

# Borrower-quality model: used for property (secured) loans, whose tenures and sizes are far
# outside the personal-loan training data. Affordability and collateral are handled by explicit
# FOIR and RBI loan-to-value rules in the backend decision engine.
BORROWER_NUMERIC = [
    'credit_score',
    'existing_debt_to_income',
    'years_employed',
    'missed_payments_2y',
    'credit_applications_6m',
    'credit_history_years',
]
BORROWER_CATEGORICAL = ['residence']

# Human-readable names used in explanations.
FEATURE_LABELS = {
    'credit_score': 'Credit score',
    'existing_debt_to_income': 'Existing EMIs vs income',
    'loan_to_income': 'Loan amount vs annual income',
    'emi_to_income': 'New EMI vs income',
    'tenure_months': 'Loan tenure',
    'years_employed': 'Years in current job/business',
    'missed_payments_2y': 'Missed payments (last 2 years)',
    'credit_applications_6m': 'Recent credit applications',
    'credit_history_years': 'Length of credit history',
    'residence': 'Residence type',
    'purpose': 'Loan purpose',
}

# Monotonic direction of risk for each numeric feature (+1: higher value => higher risk).
MONOTONIC = {
    'credit_score': -1,
    'existing_debt_to_income': 1,
    'loan_to_income': 1,
    'emi_to_income': 1,
    'tenure_months': 1,
    'years_employed': -1,
    'missed_payments_2y': 1,
    'credit_applications_6m': 1,
    'credit_history_years': -1,
}

# Lending Club data covers 36/60-month loans; clamp the tenure feature to that range.
MODEL_TENURE_RANGE = (36, 60)


def cibil_to_fico(cibil: float) -> float:
    """Map an Indian CIBIL score (300-900) onto the FICO scale (300-850) used in training."""
    cibil = min(max(float(cibil), 300.0), 900.0)
    return 300.0 + (cibil - 300.0) * (550.0 / 600.0)


def emi(principal: float, annual_rate_pct: float, months: int) -> float:
    """Standard reducing-balance EMI."""
    if principal <= 0 or months <= 0:
        return 0.0
    r = annual_rate_pct / 12.0 / 100.0
    if r == 0:
        return principal / months
    factor = (1 + r) ** months
    return principal * r * factor / (factor - 1)


# ─── Training-data mapping (Lending Club → SecureLend features) ──────────────

_LC_PURPOSE_MAP = {
    'debt_consolidation': 'debt_consolidation',
    'credit_card': 'debt_consolidation',
    'home_improvement': 'home_renovation',
    'medical': 'medical',
    'wedding': 'wedding',
    'educational': 'education',
    'car': 'vehicle',
    'small_business': 'business',
    'vacation': 'travel',
    'major_purchase': 'major_purchase',
}
_LC_HOME_MAP = {'RENT': 'rented', 'OWN': 'owned', 'MORTGAGE': 'owned_mortgage'}


def _parse_emp_length(value: Any) -> float:
    if not isinstance(value, str):
        return np.nan
    if value.startswith('<'):
        return 0.0
    digits = ''.join(ch for ch in value if ch.isdigit())
    return float(digits) if digits else np.nan


def features_from_lending_club(raw: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, pd.Series]:
    """Convert the raw Lending Club columns into model features, target and issue date."""
    df = raw.copy()
    df = df[df['annual_inc'].fillna(0) > 0]
    df = df.dropna(subset=['earliest_cr_line', 'delinq_2yrs', 'inq_last_6mths'])

    issue = pd.to_datetime(df['issue_d'], format='%b-%Y')
    first_credit = pd.to_datetime(df['earliest_cr_line'], format='%b-%Y', errors='coerce')
    annual_income = df['annual_inc'].astype(float)

    features = pd.DataFrame(
        {
            'credit_score': (df['fico_range_low'] + df['fico_range_high']) / 2.0,
            'existing_debt_to_income': df['dti'].astype(float),
            'loan_to_income': df['loan_amnt'].astype(float) / annual_income,
            'emi_to_income': df['installment'].astype(float) * 12.0 / annual_income * 100.0,
            'tenure_months': df['term'].str.extract(r'(\d+)')[0].astype(float),
            'years_employed': df['emp_length'].map(_parse_emp_length),
            'missed_payments_2y': df['delinq_2yrs'].astype(float).clip(0, 10),
            'credit_applications_6m': df['inq_last_6mths'].astype(float).clip(0, 10),
            'credit_history_years': ((issue - first_credit).dt.days / 365.25).clip(lower=0),
            'residence': df['home_ownership'].map(_LC_HOME_MAP).fillna('rented'),
            'purpose': df['purpose'].map(_LC_PURPOSE_MAP).fillna('other'),
        }
    )
    target = df['loan_status'].str.contains('Charged Off').astype(int)
    keep = features['credit_history_years'].notna()
    return features[keep].reset_index(drop=True), target[keep].reset_index(drop=True), issue[keep].reset_index(drop=True)


# ─── Application mapping (website form → model features) ─────────────────────


def features_from_application(payload: dict[str, Any]) -> dict[str, Any]:
    """Build one feature row from an application payload sent by the backend."""

    def num(key: str, default: float = 0.0) -> float:
        value = payload.get(key, default)
        try:
            value = float(value)
        except (TypeError, ValueError):
            return default
        return default if math.isnan(value) else value

    monthly_income = max(num('monthlyIncome'), 1.0)
    annual_income = monthly_income * 12.0
    loan_amount = max(num('loanAmount'), 0.0)
    tenure = int(num('tenureMonths', 36)) or 36
    new_emi = num('newEmi', 0.0)
    if new_emi <= 0:
        new_emi = emi(loan_amount, num('interestRate', 13.0), tenure)

    residence = str(payload.get('residenceType') or 'rented').lower()
    purpose = str(payload.get('purpose') or 'other').lower()

    return {
        'credit_score': cibil_to_fico(num('creditScore', 650)),
        'existing_debt_to_income': min(num('existingEmi') / monthly_income * 100.0, 100.0),
        'loan_to_income': loan_amount / annual_income,
        'emi_to_income': new_emi * 12.0 / annual_income * 100.0,
        'tenure_months': float(min(max(tenure, MODEL_TENURE_RANGE[0]), MODEL_TENURE_RANGE[1])),
        'years_employed': min(max(num('yearsEmployed'), 0.0), 10.0),
        'missed_payments_2y': min(max(num('missedPayments'), 0.0), 10.0),
        'credit_applications_6m': min(max(num('recentCreditApplications'), 0.0), 10.0),
        'credit_history_years': max(num('creditHistoryYears'), 0.0),
        'residence': 'rented' if residence == 'family' else (residence if residence in RESIDENCE_TYPES else 'rented'),
        'purpose': purpose if purpose in PURPOSES else 'other',
    }


def describe_value(feature: str, value: Any) -> str:
    """Format a feature value for display in explanations."""
    if feature == 'credit_score':
        # Show the CIBIL-scale value the applicant entered.
        return f"{round(300 + (float(value) - 300) * 600 / 550)}"
    if feature in ('existing_debt_to_income', 'emi_to_income'):
        return f"{float(value):.0f}% of income"
    if feature == 'loan_to_income':
        return f"{float(value):.1f}× annual income"
    if feature == 'tenure_months':
        return f"{int(value)} months"
    if feature in ('years_employed', 'credit_history_years'):
        return f"{float(value):.0f} years"
    if feature in ('missed_payments_2y', 'credit_applications_6m'):
        return f"{int(value)}"
    return str(value).replace('_', ' ')
