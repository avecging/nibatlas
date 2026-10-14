# Security policy

## Reporting a vulnerability or exposed secret

Please use GitHub's private vulnerability reporting for this repository. Do not
open a public issue containing exploit details, credentials, private user data,
or sensitive infrastructure information.

If a credential may have entered Git history or an Actions log:

1. revoke or rotate it immediately;
2. remove the affected workflow run or artifact where possible;
3. treat history rewriting as containment, not as a substitute for rotation;
4. document the remediation privately.

## Supported version

Security fixes currently target the latest commit on `main`.
