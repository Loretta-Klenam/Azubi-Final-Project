#!/usr/bin/env python3
"""Seed the events table with 10 sample PUBLISHED events (Accra + Kumasi).

Writes directly to DynamoDB with boto3 (bypasses the API/admin auth), matching
the exact item shape backend/functions/create_event/handler.py writes. Uses
the caller's local AWS credentials/region -- run against whichever account
your `aws` CLI is configured for.

Usage:
    python3 scripts/seed-events.py [--table TABLE_NAME] [--region REGION]

If --table is omitted, the table name is looked up from the
event-ticketing-data CloudFormation stack outputs.
"""
from __future__ import annotations

import argparse
import uuid
from datetime import datetime, timedelta, timezone

import boto3

EVENTS = [
    {
        "title": "Accra Tech Summit",
        "description": "A day of talks and workshops on Ghana's growing tech ecosystem.",
        "venue": "Kempinski Hotel Gold Coast City, Accra",
        "days_from_now": 14,
        "duration_hours": 8,
        "capacity": 500,
    },
    {
        "title": "Accra Jazz Night",
        "description": "An evening of live jazz featuring local and international artists.",
        "venue": "National Theatre, Accra",
        "days_from_now": 21,
        "duration_hours": 3,
        "capacity": 300,
    },
    {
        "title": "Accra Food & Culture Festival",
        "description": "Celebrate Ghanaian cuisine with food stalls, live music, and cultural displays.",
        "venue": "Independence Square, Accra",
        "days_from_now": 28,
        "duration_hours": 10,
        "capacity": 1000,
    },
    {
        "title": "Accra Startup Pitch Day",
        "description": "Early-stage startups pitch to a panel of investors and mentors.",
        "venue": "Impact Hub Accra",
        "days_from_now": 35,
        "duration_hours": 5,
        "capacity": 150,
    },
    {
        "title": "Accra Marathon",
        "description": "A citywide charity marathon with 5K, 10K, and full marathon routes.",
        "venue": "Black Star Square, Accra",
        "days_from_now": 42,
        "duration_hours": 6,
        "capacity": 2000,
    },
    {
        "title": "Kumasi Trade Fair",
        "description": "Regional trade fair showcasing manufacturers, artisans, and agribusiness.",
        "venue": "Kumasi Trade Fair Centre",
        "days_from_now": 16,
        "duration_hours": 9,
        "capacity": 800,
    },
    {
        "title": "Kumasi Music Festival",
        "description": "A full-day festival featuring highlife, hiplife, and gospel artists.",
        "venue": "Baba Yara Sports Stadium, Kumasi",
        "days_from_now": 24,
        "duration_hours": 8,
        "capacity": 5000,
    },
    {
        "title": "Kumasi Business Conference",
        "description": "Conference for SMEs on financing, growth, and regional trade opportunities.",
        "venue": "Golden Bean Hotel, Kumasi",
        "days_from_now": 30,
        "duration_hours": 6,
        "capacity": 400,
    },
    {
        "title": "Kumasi Cultural Heritage Day",
        "description": "Ashanti cultural displays, drumming, dance, and craft exhibitions.",
        "venue": "Manhyia Palace Museum, Kumasi",
        "days_from_now": 38,
        "duration_hours": 7,
        "capacity": 600,
    },
    {
        "title": "Kumasi Tech & Innovation Fair",
        "description": "Showcasing student and startup innovation projects from the Ashanti region.",
        "venue": "KNUST Conference Centre, Kumasi",
        "days_from_now": 45,
        "duration_hours": 8,
        "capacity": 700,
    },
]


def resolve_table_name(region: str) -> str:
    cfn = boto3.client("cloudformation", region_name=region)
    outputs = cfn.describe_stacks(StackName="event-ticketing-data")["Stacks"][0]["Outputs"]
    for output in outputs:
        if output["OutputKey"].startswith("PublishOutputRefEventsTable"):
            return output["OutputValue"]
    raise SystemExit("Could not find the events table name in event-ticketing-data stack outputs.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--table", default=None, help="Events DynamoDB table name")
    parser.add_argument("--region", default="us-east-1")
    args = parser.parse_args()

    table_name = args.table or resolve_table_name(args.region)
    table = boto3.resource("dynamodb", region_name=args.region).Table(table_name)

    now = datetime.now(timezone.utc).isoformat()
    created = []
    for event in EVENTS:
        start = datetime.now(timezone.utc) + timedelta(days=event["days_from_now"])
        end = start + timedelta(hours=event["duration_hours"])
        item = {
            "eventId": str(uuid.uuid4()),
            "title": event["title"],
            "description": event["description"],
            "venue": event["venue"],
            "startDateTime": start.isoformat(),
            "endDateTime": end.isoformat(),
            "capacity": event["capacity"],
            "registeredCount": 0,
            "status": "PUBLISHED",
            "createdBy": "seed-script",
            "createdAt": now,
            "updatedAt": now,
        }
        table.put_item(Item=item)
        created.append((item["eventId"], item["title"], item["venue"]))

    print(f"Seeded {len(created)} events into {table_name}:")
    for event_id, title, venue in created:
        print(f"  {event_id}  {title} ({venue})")


if __name__ == "__main__":
    main()
