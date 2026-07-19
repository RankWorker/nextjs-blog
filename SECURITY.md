# Security policy

## Supported versions

Security fixes are provided for the latest published minor release. After a security release is available, older affected releases may no longer receive fixes.

## Reporting a vulnerability

Please use GitHub's private **Report a vulnerability** form when it is available, or email `support@rankworker.com`. Do not open a public issue for a suspected vulnerability.

Include the affected version, a reproducible description, impact, and any suggested mitigation. We aim to acknowledge reports within three business days, provide an initial assessment within seven business days, and coordinate disclosure after a fix is available. Complex reports may require more time; we will keep the reporter informed.

## Consumer security responsibilities

The Direct API key and webhook secret are server-only credentials. Consumers must not expose them through `NEXT_PUBLIC_` variables.

JavaScript expressions in MDX are blocked by default. Enabling `dangerouslyAllowMdxJavaScript` treats local and API article bodies as trusted server-side code. The dangerous-operation checks provided by the MDX compiler are defense in depth, not a sandbox. Do not enable this option for untrusted user-authored content or a publishing pipeline whose authors, accounts, and delivery systems are not fully trusted.
