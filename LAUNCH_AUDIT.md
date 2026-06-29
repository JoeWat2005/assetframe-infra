# AssetFrame Launch Audit Specification

## Objective

Prepare AssetFrame for production launch in its current MVP state.

This is not a feature-development task.

This is a launch-readiness, security-hardening, bug-fixing, test-coverage, accessibility, consistency, performance and cleanup audit.

The objective is to make the current system:

* secure
* reliable
* consistent
* tested
* maintainable
* launch-ready

while preserving existing functionality.

---

# Core Principles

1. Security first.
2. Do not trust user input.
3. Do not trust query parameters.
4. Do not trust webhook payloads without verification.
5. UI gating is never sufficient.
6. Server-side authorization is mandatory.
7. Fix safe issues directly.
8. Avoid risky rewrites.
9. Document anything that cannot be verified.
10. Re-run tests after changes.

---

# Architecture Areas To Audit

## Frontend

* Next.js routes
* layouts
* components
* navigation
* forms
* metadata
* accessibility
* mobile experience

## Backend

* API routes
* MCP endpoints
* server actions
* middleware
* authentication
* authorization

## Data Layer

* Neon Postgres
* migrations
* sync-db
* JSON fallbacks
* report catalog

## Storage

* Cloudflare R2
* signed URLs
* public/private assets
* report downloads

## Auth & Billing

* Clerk
* Clerk Billing (Stripe under the hood — NOT Lemon Squeezy)
* subscriptions
* entitlements
* admin access

## Report Engine

* report generation
* prediction generation
* ledger scoring
* publishing pipeline

---

# Security Audit

Review and test for:

* SQL injection
* XSS
* CSRF
* SSRF
* open redirects
* path traversal
* auth bypasses
* privilege escalation
* broken access control
* secret leakage
* insecure logging
* dependency vulnerabilities
* unsafe API inputs
* unsafe report rendering

Review:

* CSP
* security headers
* CORS
* cookies
* sessions
* redirects
* webhook verification

Provide recommended fixes and apply low-risk improvements.

---

# Auth & Entitlement Audit

Verify:

* signed-out users
* free users
* Pro users
* cancelled users
* expired users
* admin users

Confirm:

* Pro content cannot be accessed without entitlement
* Admin content cannot be accessed without admin rights
* Downloads are protected server-side
* API routes enforce permissions correctly

Review:

* Clerk integration
* Clerk Billing integration (Stripe under the hood)
* webhook handling
* billing state transitions

---

# Business Logic Audit

Review:

* report catalog
* report detail pages
* Snapshot reports
* Pro reports
* track record
* account pages
* subscriptions
* admin pages

Test:

* empty states
* malformed URLs
* missing content
* missing metadata
* stale subscriptions
* expired downloads
* failed services

---

# Report Engine Audit

Review:

* report generation
* prediction generation
* confidence calculations
* publishing
* scoring
* ledger updates

Verify:

* ledger remains append-only
* predictions are scored correctly
* report artifacts remain consistent
* publication cannot expose Pro content accidentally

Review edge cases:

* weekends
* holidays
* missing market data
* degraded data
* malformed files

---

# Site Consistency Audit

Review every public page.

Research

* Reports
* Track record
* Reviews

Product

* How it works
* Pricing
* FAQ

Developers

* Overview
* MCP server
* REST API

Company

* About
* Feedback
* Contact
* Terms
* Privacy
* Accessibility

Verify consistency of:

* methodology
* pricing
* Pro benefits
* confidence language
* disclaimers
* legal language
* accessibility claims
* MCP/API descriptions
* track-record descriptions

No page should contradict another page.

---

# Accessibility Audit

Target WCAG 2.2 AA.

Review:

* keyboard navigation
* focus management
* dropdowns
* mobile menu
* forms
* labels
* aria attributes
* color contrast
* reduced motion
* semantic structure

Ensure:

* menus are accessible
* navigation works with keyboard only
* screen-reader labels exist
* focus states are visible

---

# Performance Audit

Review:

* bundle size
* rendering performance
* client/server boundaries
* images
* fonts
* caching
* ISR/revalidation
* database queries

Fix low-risk issues.

Document larger opportunities.

---

# SEO Audit

Review:

* metadata
* canonical URLs
* OpenGraph
* Twitter cards
* sitemap
* robots.txt
* llms.txt
* structured data

Verify:

* report pages
* track record
* pricing
* developers pages
* company pages

---

# Testing Requirements

Create or improve:

## Unit Tests

* helpers
* filters
* sorting
* confidence logic
* entitlement logic
* report utilities

## Integration Tests

* reports
* track record
* account
* pricing
* developers pages
* admin flows

## API Tests

* authentication
* authorization
* malformed input
* missing input
* invalid methods
* entitlement enforcement

## Security Tests

* SQL injection payloads
* XSS payloads
* path traversal attempts
* invalid redirects
* unauthorized access attempts

## Accessibility Tests

* navigation
* menus
* forms
* major pages

## E2E Tests

* homepage
* navigation
* reports
* account
* pricing
* authentication
* gated content
* mobile menu

Tests should protect both existing and future functionality.

---

# Cleanup

Identify and safely remove:

* dead code
* duplicate code
* duplicate constants
* unused imports
* unused dependencies
* stale files
* debug logging
* obsolete helpers

Document all removals.

---

# Final Deliverables

Produce:

1. Executive summary
2. Launch readiness assessment
3. Security report
4. Business logic report
5. Accessibility report
6. Performance report
7. SEO report
8. Test coverage report
9. Cleanup report
10. Site consistency report
11. Launch checklist
12. Post-launch backlog

Classify findings as:

* Blocker
* High
* Medium
* Low

Apply safe fixes where possible.

Document anything not verified.

The final result should be a production-ready MVP suitable for launch.
