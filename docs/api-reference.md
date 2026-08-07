# API Reference

Base path: `{ApiEndpoint}` (a CloudFormation output of `ApiStack`, e.g.
`https://abc123.execute-api.us-east-1.amazonaws.com/v1`).

All responses are JSON. All error responses share this shape:

```json
{
  "errorCode": "VALIDATION_ERROR",
  "message": "Request validation failed.",
  "details": [{ "field": "attendeeEmail", "message": "value is not a valid email address" }]
}
```

`details` is only present for `VALIDATION_ERROR`.

## Public endpoints

### `GET /events`

List published, upcoming events. Query params: `limit` (default 20, max 100), `cursor`
(opaque pagination token from a previous response's `nextCursor`).

```json
{ "items": [ { "eventId": "...", "title": "...", "status": "PUBLISHED", "...": "..." } ], "nextCursor": null }
```

### `GET /events/{eventId}`

A single event. Returns `404 NOT_FOUND` if it doesn't exist *or* isn't `PUBLISHED` --
drafts and cancelled events are indistinguishable from nonexistent ones to public
callers.

### `POST /events/{eventId}/registrations`

Register for an event.

Request body:

```json
{ "attendeeName": "Ama Serwaa", "attendeeEmail": "ama@example.com" }
```

`201 Created`:

```json
{
  "registrationId": "b6b1...",
  "eventId": "...",
  "attendeeName": "Ama Serwaa",
  "attendeeEmail": "ama@example.com",
  "confirmationCode": "K7M4QX2P",
  "status": "CONFIRMED",
  "registeredAt": "2026-08-07T12:00:00+00:00",
  "ticketQrUrl": "https://...presigned-s3-url... (valid 15 minutes)"
}
```

Failure modes (all `409 Conflict` unless noted):

| `errorCode` | Meaning |
|---|---|
| `VALIDATION_ERROR` (400) | Missing/invalid name or email. |
| `NOT_FOUND` (404) | `eventId` doesn't exist. |
| `EVENT_NOT_PUBLISHED` | Event is `DRAFT` or `CANCELLED`. |
| `REGISTRATION_CLOSED` | The event's `startDateTime` has already passed. |
| `DUPLICATE_REGISTRATION` | This email already has a confirmed registration for this event. |
| `EVENT_SOLD_OUT` | `registeredCount` has reached `capacity`. |

### `GET /registrations/{registrationId}?code={confirmationCode}`

Look up a ticket. The confirmation code is required and must match -- a wrong code
returns the same `404 NOT_FOUND` as a nonexistent `registrationId` (this is deliberate;
see [ADR-0004](adr/0004-qr-ticket-storage.md)).

```json
{
  "registrationId": "...",
  "eventId": "...",
  "attendeeName": "...",
  "attendeeEmail": "...",
  "status": "CONFIRMED",
  "registeredAt": "...",
  "cancelledAt": null,
  "ticketQrUrl": "https://...presigned-s3-url... (freshly generated, valid 15 minutes)",
  "event": { "title": "...", "venue": "...", "startDateTime": "...", "endDateTime": "..." }
}
```

### `DELETE /registrations/{registrationId}?code={confirmationCode}`

Self-service cancellation. Same 404-on-mismatch behavior as the GET above. On success:

```json
{ "registrationId": "...", "status": "CANCELLED", "cancelledAt": "..." }
```

`409 ALREADY_CANCELLED` if it was already cancelled.

## Admin endpoints (require `Authorization: Bearer <Cognito ID token>`, `Admins` group)

### `GET /admin/events`

Like `GET /events`, but an optional `status` query param may be any value (or omitted
for all statuses, including `DRAFT`), and results are not restricted to `PUBLISHED`.

### `GET /admin/events/{eventId}`

Like `GET /events/{eventId}`, but returns the event regardless of status.

### `POST /admin/events`

Create an event.

```json
{
  "title": "AWS Community Day",
  "description": "A day of AWS talks and workshops.",
  "venue": "Accra Digital Centre",
  "startDateTime": "2026-12-01T09:00:00Z",
  "endDateTime": "2026-12-01T17:00:00Z",
  "capacity": 150,
  "status": "DRAFT"
}
```

`201 Created` with the full event object (`eventId`, `registeredCount: 0`, timestamps
added).

### `PUT /admin/events/{eventId}`

Partial update -- send only the fields you want to change. `200 OK` with the updated
event, or `404 NOT_FOUND`.

### `DELETE /admin/events/{eventId}`

Permanently deletes an event. Refuses with `409 EVENT_HAS_REGISTRANTS` if
`registeredCount > 0` and the event isn't already `CANCELLED` -- cancel it first (`PUT`
with `status: "CANCELLED"`) as a deliberate, reversible step before permanent deletion.

### `GET /admin/events/{eventId}/registrations`

Paginated list of registrants for one event (`limit`, `cursor` query params, same shape
as `GET /events`), most recently registered first.

### `DELETE /admin/registrations/{registrationId}`

Admin cancellation -- no confirmation code required, authorized by the caller's Cognito
identity instead. Same response/error shape as the public cancel endpoint.

## Authentication

Admin endpoints require a valid Cognito ID token (JWT) for a user in the `Admins`
group, obtained via the SPA's login flow (`amazon-cognito-identity-js`, SRP
authentication). See [ADR-0002](adr/0002-cognito-admin-auth.md) and
[deployment.md](deployment.md#creating-the-first-admin-user) for how admin accounts are
created.
