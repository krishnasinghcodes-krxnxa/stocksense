# AGENTS.md — StockSense Agent Guidelines & Skills

This repository follows engineering and agent principles combined from:
- **[Matt Pocock's Skills](https://github.com/mattpocock/skills)**: Engineering rigor, domain modeling, TDD, and test verification.
- **[Ponytail](https://github.com/DietrichGebert/ponytail)**: Lazy Senior Dev mode: YAGNI, native platform features, standard library first, zero unnecessary dependencies, minimum code that completely solves the problem.
- **[ECC](https://github.com/affaan-m/ECC)**: Security guardrails, parameterization against SQL injection, clean testing, performance optimization.

---

## 1. Core Principles (Ponytail Ladder)

Before writing any code, stop at the first rung that holds:
1. **Does this need to exist?** → No: skip it (YAGNI).
2. **Already in this codebase?** → Reuse it, don't rewrite.
3. **Python Standard Library does it?** → Use `sqlite3`, `hashlib`, `secrets`, `datetime`, `json`.
4. **Native Web Platform feature?** → Use native `<dialog>`, HTML5 form validation, CSS variables, `fetch()`.
5. **Installed dependency?** → Use Flask and Flask-CORS.
6. **One line?** → Keep it clean and concise.
7. **Only then: write the minimum robust code that works.**

Root causes over symptoms:
- Trace full data flow before writing. Fix the shared logic once rather than patching symptoms in multiple places.

## 2. Security & Performance (ECC)

- **Input Validation**: Validate types, positive quantities, and required fields at trust boundaries.
- **SQL Security**: Always use parameterized queries (`cursor.execute("... WHERE id = ?", (id,))`). Never format or concatenate SQL strings.
- **Password Security**: Store salted hashes with PBKDF2 (`hashlib.pbkdf2_hmac`).
- **Data Integrity**: Use SQLite transactions (`BEGIN TRANSACTION ... COMMIT`) with immediate rollbacks on errors.
- **Zero Secrets in Git**: Never commit API keys, personal access tokens, or sensitive credentials.

## 3. Engineering Rigor (Matt Pocock Skills)

- Every domain model represents real inventory entities (Product, Receipt, Delivery, Transfer, Adjustment, Ledger).
- Every state change that affects physical inventory MUST log an immutable entry in the Stock Ledger.
- Verify changes with runnable automated tests (`tests/test_api.py`).

---

## Skills Directory Reference
- `.agents/skills/ponytail/`: Ponytail senior dev skills and audit rules.
- `.agents/skills/engineering/`: TDD, domain modeling, bug diagnostics.
- `.agents/skills/ecc/`: Security, performance, architecture guidelines.
- `.cursor/rules/`: Cursor IDE rules for Python, TypeScript, testing, security, and Ponytail.
