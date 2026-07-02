# Software Test Report (STR) — GeeksHub

| | |
|---|---|
| **Project** | GeeksHub |
| **Parent documents** | GeeksHub_STP_Software_Test_Plan.md, GeeksHub_STD_Software_Test_Description.md |
| **Prepared by** | Laith Mimi |
| **Date** | 2 July 2026 |
| **Status** | **TEMPLATE — no test cases have been executed yet** |

---

## Important note on honesty of this document

This STR is a **results-tracking template**, not a completed report. I have not run any of the 41 test cases in the STD against a live instance — I only reviewed the source code to write them. That means every row below is `Not Executed` except three items that are **confirmed defects from code review alone** (marked accordingly, not from execution). Filling in real Pass/Fail results for the rest requires you to actually run the backend locally and execute the STD test cases — I can help you write pytest fixtures or a Postman collection to speed that up, but I'm not going to fabricate execution data. A test report with invented "100% pass" rows would be worse than no report at all, especially for a graduation submission where grounding was explicitly the standard you set for the rest of the report.

---

## 1. Execution Summary

| Metric | Value |
|---|---|
| Total test cases (STD) | 41 |
| Executed | 0 |
| Passed | 0 |
| Failed | 0 |
| Not executed | 38 |
| Confirmed defects from code review (pre-execution) | 3 |
| P1 cases executed / required | 0 / 26 |
| **Exit criteria met (per STP §5)?** | **No — 0% of P1 cases executed** |

---

## 2. Results Log

Copy this table structure and fill in `Actual Result`, `Status`, `Date`, `Tested By`, `Defect ID` as you execute each STD case. Status values: `Pass` / `Fail` / `Blocked` / `Not Executed`.

| Test Case ID | Priority | Status | Actual Result | Defect ID | Date | Tested By |
|---|---|---|---|---|---|---|
| AUTH-001 | P1 | Not Executed | | | | |
| AUTH-002 | P1 | Not Executed | | | | |
| AUTH-003 | P1 | Not Executed | | | | |
| AUTH-004 | P1 | Not Executed | | | | |
| AUTH-005 | P2 | Not Executed | | | | |
| AUTH-006 | P1 | Not Executed | | | | |
| AUTH-007 | P1 | Not Executed | | | | |
| AUTH-008 | P1 | Not Executed | | | | |
| AUTH-009 | P1 | Not Executed | | | | |
| AUTH-010 | P1 | Not Executed | | | | |
| RBAC-001 | P1 | Not Executed | | | | |
| RBAC-002 | P1 | Not Executed | | | | |
| RBAC-003 | P1 | Not Executed | | | | |
| FILE-001 | P1 | Not Executed | | | | |
| FILE-002 | P1 | Not Executed | | | | |
| FILE-003 | P2 | Not Executed | | | | |
| FILE-004 | P1 | **Confirmed defect (code review)** | UI limit constant ≠ backend `MAX_FILE_SIZE_MB` (25MB vs 15MB) — see Defect Log DEF-001 | DEF-001 | 2026-07-02 | Laith (code review) |
| FILE-005 | P1 | Not Executed | | | | |
| FILE-006 | P1 | Not Executed | | | | |
| ADMIN-001 | P1 | Not Executed | | | | |
| ADMIN-002 | P1 | Not Executed | | | | |
| ADMIN-003 | P1 | Not Executed | | | | |
| ADMIN-004 | P2 | Not Executed | | | | |
| ADMIN-005 | P2 | Not Executed | | | | |
| ADMIN-006 | P2 | Not Executed | | | | |
| VIEW-001 | P1 | Not Executed | | | | |
| VIEW-002 | P1 | Not Executed | | | | |
| VIEW-003 | P1 | Not Executed | | | | |
| VIEW-004 | P2 | Not Executed | | | | |
| VIEW-005 | P1 | Not Executed | | | | |
| VIEW-006 | P2 | Not Executed | | | | |
| GAM-001 | P2 | Not Executed | | | | |
| GAM-002 | P3 | Not Executed | | | | |
| DIR-001 | P2 | Not Executed | | | | |
| DIR-002 | P1 | Not Executed | | | | |
| DIR-003 | P3 | Not Executed | | | | |
| CAT-001 | P2 | Not Executed | | | | |
| TASK-001 | P1 | Not Executed | | | | |
| AI-001 | P1 | Not Executed | | | | |
| AI-002 | P2 | Not Executed | | | | |
| AI-003 | P3 | Not Executed | | | | |

---

## 3. Defect Log

Only defects confirmed so far are from static code review, not execution. Add rows here as you find real failures during execution.

| Defect ID | Severity | Related Test Case | Description | Recommended Fix | Status |
|---|---|---|---|---|---|
| DEF-001 | P1 | FILE-004 | Frontend advertises a 25MB upload limit; backend `MAX_FILE_SIZE_MB = 15` in `upload_utils.py` hard-rejects anything over 15MB. A student can select and start uploading a 20MB file, get through the whole upload, and only then see a failure. | Align the two limits — either drop the frontend constant to 15MB (fast fix) or raise the backend limit to 25MB if that was the original product intent (needs confirming GCS cost/storage impact first). This is a UX/trust issue, not a security one — treat it as easy and cheap to fix, so fix it now rather than deferring. | Open |
| DEF-002 | Info / Accepted-risk candidate | AUTH-009 | Cookie `samesite="none"` in production is a documented CSRF-exposure pattern. Whether this is an accepted risk or needs mitigation (e.g., CSRF token on state-changing routes) is a product/security decision, not purely a testing one. | Decide explicitly: accept the risk with a written rationale, or add CSRF-token protection on top of the cookie for state-changing endpoints. Don't leave it undecided. | Needs decision |
| DEF-003 | P2 | (not in STD yet — add a case) | `UserCourseActivity.total_files` is known to not be populated by current code (per project notes), meaning any UI relying on it (e.g., a "X of Y files" progress indicator) will silently show wrong data with no error. | Add a test case for this specifically (it won't crash, so it will only ever be caught by an explicit assertion, never by "the app didn't break"). Then either populate the field on upload approval or remove it from any UI that reads it. | Open |

---

## 4. Coverage Gaps Worth Naming Explicitly

Rather than silently under-testing these, name them so a reader of this report knows they were a deliberate scope decision, not an oversight:

- **IDOR pattern check across `/me/*` routers** — FILE-006 and TASK-001 both probe "can User B touch User A's resource by ID." Recommend running the same probe against `/me/notes`, `/me/notifications/{id}/read`, and `/me/pinned-courses/{course_id}` before considering ownership isolation "tested," since this looks like it could be a systemic pattern rather than a one-off.
- **Concurrency testing (VIEW-006)** is hard to do manually with any confidence — worth a small scripted test (two parallel `curl`/httpx requests) rather than trying to trigger it by hand.
- **Load/performance** is explicitly out of scope per the STP — not tested, not claimed to be fine.

---

## 5. Recommendation

Do not present this STR as "testing complete" in the graduation report as-is. Two honest options:

1. **Execute the 26 P1 cases for real** before submission — even a few hours against a local instance with seed data would let this become a genuine report with real Pass/Fail data, which is a much stronger artifact than a well-written plan with no execution behind it.
2. If time genuinely doesn't allow full execution, present the STP + STD as the test **design** artifact (which is legitimate and demonstrates process maturity), and be explicit in the STR that execution is partial/pending — exactly as this document currently states. That's still defensible; a report that quietly implies full pass rates it never earned is not.

**One question that moves this forward:** do you want to actually execute the P1 test cases against your local backend now (I can walk you through it case-by-case and log real results), or do you want me to convert the P1 cases into a runnable pytest file first so execution is faster and repeatable?
