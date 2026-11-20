# Training data

`lending_club_2007_2011.csv.gz` has 42,522 real personal loans issued by Lending Club (US) between
June 2007 and December 2011. Every loan has reached a final outcome (`Fully Paid` or `Charged Off`).

## How it was built
Lending Club published loan-level data for every loan it issued. Two public copies of the
2007–2011 file were combined:

1. **Final outcomes.** `Loan.csv` from
   https://github.com/yanhan-si/LendingClub-Loan-Default-Prediction. A later snapshot where every
   loan has finished, but the FICO columns were removed.
2. **Credit scores.** `LoanStats3a.csv` from https://github.com/yhat/demo-lending-club. An earlier
   snapshot of the same loans that still has `fico_range_low` / `fico_range_high`.

The loan ID was scrubbed in copy 1, so loans were matched on eight application fields together
(`loan_amnt, funded_amnt, installment, annual_inc, dti, revol_bal, open_acc, total_acc`).
42,522 of 42,538 loans matched one-to-one. Every loan already finished in the earlier snapshot
has the same outcome in the later one.

## Columns kept
`loan_status, loan_amnt, term, installment, int_rate, annual_inc, dti, emp_length, home_ownership,
purpose, delinq_2yrs, inq_last_6mths, pub_rec, earliest_cr_line, issue_d, fico_range_low,
fico_range_high, revol_util, verification_status`

Information created after the loan was issued (payments, recoveries, last FICO pull) was excluded
to avoid target leakage. `int_rate`, `installment` and `verification_status` are kept for
reference, but the lender-assigned rate and grade are not model inputs.
