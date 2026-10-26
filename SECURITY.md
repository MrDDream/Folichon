# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private reporting instead: **Security → Report a vulnerability** on this repository. Include the version (or commit), the steps to reproduce and the impact you expect. You should get an answer within a week.

## Supported versions

Only the latest release (and the `latest` Docker image) receives security fixes.

## Scope

In scope: the public page, the admin (sign-in, two-factor authentication, sessions, saving, uploads) and the Docker image.

Out of scope: weak passwords chosen by the person running the site, a server exposed without HTTPS, and a reverse proxy configured to trust every `X-Forwarded-For` header.
