# `meeting_lookup` — meetings, transcripts, and attendees

Find calendar meetings. Scope: the user's own calendar by default; another person's calendar via `peer`; shared / resource calendars via `calendar_ids`. Transcripts are read separately with `read_document`.

## When to use

- "What was decided in the X meeting?" — find the meeting, then read its transcript
- "When did we discuss Y?" — meetings on a topic
- "What's on my calendar today?" — your schedule
- "What meetings does Alice have tomorrow?" — peer schedule
- "Action items from last week's standup" — transcript content for a known meeting

**Don't** use for:
- Documents *attached* to meetings (the linked docs are reachable via `search`)
- Email threads about meetings (use `gmail_search` / `outlook_search`)

## Parameters

| Parameter | Type | Notes |
|---|---|---|
| `after` / `before` | string (required) | Date range. **Both bounds are inclusive**, and both are required on every call. Accepts `today`, `yesterday`, `tomorrow`, `now`, `this_week`, `last_week`, `next_week`, `this_month`, `last_month`, `next_month`, or `YYYY-MM-DD`. |
| `query` | string | Topic / title keywords. Optional. |
| `participants` | string array | Names or emails to filter the user's **own** calendar by attendees. For someone else's calendar, use `peer`. |
| `peer` | string | Email of another person whose calendar to look up. Must be an email — resolve a name with `employee_search` first. ONE per call. |
| `calendar_ids` | string array | Shared, subscribed, or resource calendars (Google Calendar or Outlook). Use `"primary"` for the user's own. Never invent IDs (see pitfalls). |
| `cursor` | string | Pagination token from a previous response that has more results. Omit on the first call. |

## Date handling

- **Bounds are inclusive — don't pad.** `after="2025-10-08", before="2025-10-08"` returns every meeting on Oct 8. Widening to `2025-10-07` / `2025-10-09` pulls in meetings from the neighboring days.
- **Prefer keywords for relative dates.** A keyword covers the whole named day, week, or month: `after="today", before="today"` is all of today; `after="next_week", before="next_week"` is all of next week.
- **Use `now` to split past from upcoming.** `after="today", before="now"` for meetings already held today; `after="now", before="today"` for the rest of today.
- **Use `YYYY-MM-DD` for dates the user stated.** To exclude a date, end the range the day before it: "before March 10" → `before="2024-03-09"`.
- **No range from the user?** Default to `after="last_month", before="next_week"`.
- **Use `before` / `after` for date constraints.** Inline date filters in the `query` string are unreliable.

## Examples

```
meeting_lookup(after="today", before="today")
meeting_lookup(query="quarterly planning", after="2025-10-01", before="2025-10-31")
meeting_lookup(participants=["Alice Chen"], after="last_month", before="now")
meeting_lookup(peer="bob@example.com", after="tomorrow", before="tomorrow")
meeting_lookup(calendar_ids=["primary"], after="this_week", before="this_week")
meeting_lookup(query="design review", after="last_week", before="last_week")
```

## Pitfalls

- **Don't invent `calendar_ids`.** Only use `"primary"`, an ID the user typed verbatim, or (Google Calendar only) an ID that appeared verbatim in a prior `meeting_lookup` result's `attendees` / `organizer_email`. Outlook calendar IDs never appear in results, so ask the user for them. Inventing IDs will return empty.
- **`peer` and `calendar_ids` interact.** `peer` wins when both are set.
- **`peer` needs an email.** A name returns nothing.
- **Page only when needed.** Pass the returned cursor only if the current results aren't enough, and keep every other filter identical to the original call.

## Typical follow-up

Action items from a transcript usually need follow-on `search` (the doc they reference) or `gmail_search` (the email thread). For multi-source synthesis, see [synthesis.md](synthesis.md).

## When to read transcripts

`meeting_lookup` returns meeting metadata, not transcript content. To read what was said, call `read_document` with the meeting's `meetingTranscriptUrl` when the result has one, otherwise its `url`. Pass several URLs in one call (see [read-document.md](read-document.md)).

Read transcripts when you need:
- Specific quotes or exact statements from participants
- Detailed discussion content to understand reasoning
- Action item context (what was said around an assignment)
- Decision rationale (why something was chosen)

Skip them when:
- Just listing meetings (time, attendees, titles)
- Checking who attended
- Quick schedule lookups

## What to focus on when reading transcripts

When analyzing meeting transcript content, extract and surface:

1. **Decisions made** — What was agreed? Who agreed? Is it reversible?
2. **Action items** — Tasks assigned, owners, deadlines
3. **Open questions** — Items left unresolved; follow-up required
4. **Key discussion points** — Important debates, rejected alternatives, context that explains the decision
