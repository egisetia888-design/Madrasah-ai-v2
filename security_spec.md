# Security Specification for Firestore Security Rules

## Data Invariants
1. A note, draft, project, or book document MUST belong to an authenticated user (`userId == request.auth.uid`).
2. Documents cannot be read or modified by users other than their owner.
3. Path IDs and schema parameters must be validated.

## Dirty Dozen Security Test Payloads
1. Unauthenticated write to `/notes/123`.
2. Spoofed userId in `/notes/123` (`userId` != `request.auth.uid`).
3. Cross-user read on `/notes/123` belonging to user B from user A.
4. Overly long title payload exceeding 500 characters.
5. Injected system fields or shadow keys on creation.
6. Unauthenticated list query on `/drafts`.
7. Tampering with `userId` during update on `/projects/123`.
8. Cross-user update on `/books/123`.
9. Non-string title input on `/notes/123`.
10. Unauthenticated delete request on `/projects/123`.
11. Malformed path injection with special characters into document ID.
12. Denial of wallet attack with unbounded payload size.
