"""Second trigger behind the $5 Cloud Run spend cap.

When the budget's Pub/Sub notification reports cost >= budget, detach the
project's billing account. That stops every paid service until Andrew
re-links billing. Google's documented pattern:
https://docs.cloud.google.com/billing/docs/how-to/disable-billing-with-notifications
"""

from __future__ import annotations

import base64
import json
import os

import functions_framework

PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "")


def should_cut_billing(event_data: dict) -> bool:
    payload = json.loads(base64.b64decode(event_data["message"]["data"]).decode())
    return float(payload["costAmount"]) >= float(payload["budgetAmount"])


@functions_framework.cloud_event
def stop_billing(cloud_event) -> None:
    if not should_cut_billing(cloud_event.data):
        print(f"Budget notification for {PROJECT_ID}: under budget, no action")
        return
    from googleapiclient import discovery

    billing = discovery.build("cloudbilling", "v1", cache_discovery=False)
    name = f"projects/{PROJECT_ID}"
    if billing.projects().getBillingInfo(name=name).execute().get("billingEnabled"):
        billing.projects().updateBillingInfo(name=name, body={"billingAccountName": ""}).execute()
        print(f"Billing disabled for {PROJECT_ID}: budget exceeded")
