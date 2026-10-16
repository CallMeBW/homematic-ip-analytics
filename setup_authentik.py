#!/usr/bin/env python3
"""Ensure Apartment Stats Authentik web forward-auth, allowlist, Coolify AUTHENTIK_TOKEN sync."""
from __future__ import annotations

import argparse
import os
import sys

import requests

AUTHENTIK_URL = os.environ.get("AUTHENTIK_URL", "https://auth.brianwirth.de/api/v3")
DOCKER_OUTPOST_NAME = "Docker Proxy Outpost"
DOCKER_OUTPOST_PK = os.environ.get(
    "AUTHENTIK_DOCKER_OUTPOST_PK", "c9305347-b62f-40b7-8422-8298f3a04f11"
)
APP_SLUG = "apartment-stats"
APP_NAME = "Apartment Stats"
GROUP_NAME = "apartment-stats-users"
EXTERNAL_HOST = "https://apartment-stats.brianwirth.de"
ALLOWLIST_EMAIL = os.environ.get(
    "APARTMENT_STATS_ALLOWLIST_EMAIL", "usrfish@gmail.com"
).strip().lower()
COOLIFY_APP_UUID = os.environ.get("COOLIFY_APARTMENT_STATS_APP_UUID", "")
COOLIFY_API = os.environ.get("COOLIFY_API", "https://coolify.brianwirth.de/api/v1")

OUTPOST_CONFIG = {
    "authentik_host": "https://auth.brianwirth.de",
    "authentik_host_insecure": False,
    "log_level": "info",
}


def api_headers() -> dict[str, str]:
    token = os.environ.get("AUTHENTIK_API_TOKEN", "").strip()
    if not token:
        print("Set AUTHENTIK_API_TOKEN (e.g. source ~/.config/brian/secrets.env)", file=sys.stderr)
        sys.exit(1)
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def coolify_token() -> str:
    return (
        os.environ.get("COOLIFY_API_TOKEN", "").strip()
        or os.environ.get("COOLIFY_API_KEY", "").strip()
    )


def get(path: str) -> dict:
    res = requests.get(f"{AUTHENTIK_URL}{path}", headers=api_headers(), timeout=30)
    res.raise_for_status()
    return res.json()


def post(path: str, data: dict) -> dict:
    res = requests.post(f"{AUTHENTIK_URL}{path}", headers=api_headers(), json=data, timeout=30)
    if res.status_code >= 400:
        print(f"Error {res.status_code}: {res.text}", file=sys.stderr)
    res.raise_for_status()
    if not res.text.strip():
        return {}
    return res.json()


def patch(path: str, data: dict) -> dict:
    res = requests.patch(f"{AUTHENTIK_URL}{path}", headers=api_headers(), json=data, timeout=30)
    res.raise_for_status()
    return res.json()


def put(path: str, data: dict) -> dict:
    res = requests.put(f"{AUTHENTIK_URL}{path}", headers=api_headers(), json=data, timeout=30)
    res.raise_for_status()
    return res.json()


def flow_pks() -> tuple[str, str, str]:
    flows = get("/flows/instances/")["results"]
    authz_flow = next(
        f["pk"] for f in flows if f["slug"] == "default-provider-authorization-implicit-consent"
    )
    authn_flow = next(
        (f["pk"] for f in flows if "sso" in f["slug"].lower() or "only" in f["slug"].lower()),
        None,
    )
    if not authn_flow:
        authn_flow = next(f["pk"] for f in flows if "authentication" in f["slug"])
    invalidation_flow = next(f["pk"] for f in flows if "invalidation" in f["slug"])
    return authz_flow, authn_flow, invalidation_flow


def ensure_group() -> str:
    groups = get("/core/groups/")["results"]
    group = next((g for g in groups if g["name"] == GROUP_NAME), None)
    if group:
        print(f"Group {GROUP_NAME} exists.")
        return group["pk"]
    print(f"Creating group {GROUP_NAME}...")
    return post("/core/groups/", {"name": GROUP_NAME})["pk"]


def ensure_user_in_group(group_pk: str) -> None:
    users = get(f"/core/users/?email={ALLOWLIST_EMAIL}")["results"]
    if not users:
        print(
            f"No Authentik user for {ALLOWLIST_EMAIL} — sign in with Google once, then re-run.",
            file=sys.stderr,
        )
        return
    user_pk = users[0]["pk"]
    if group_pk in (users[0].get("groups") or []):
        print(f"{ALLOWLIST_EMAIL} already in {GROUP_NAME}.")
        return
    post(f"/core/groups/{group_pk}/add_user/", {"pk": user_pk})
    print(f"Added {ALLOWLIST_EMAIL} to {GROUP_NAME}.")


PROXY_PROVIDER_BODY = {
    "name": f"{APP_NAME} Provider",
    "external_host": EXTERNAL_HOST,
    "mode": "forward_single",
    "access_token_validity": "days=365",
    "refresh_token_validity": "days=365",
}


def ensure_provider() -> tuple[int, str]:
    authz_flow, authn_flow, invalidation_flow = flow_pks()
    provider_body = {
        **PROXY_PROVIDER_BODY,
        "authorization_flow": authz_flow,
        "authentication_flow": authn_flow,
        "invalidation_flow": invalidation_flow,
    }
    try:
        app = get(f"/core/applications/{APP_SLUG}/")
        provider_pk = int(app["provider"])
        existing = get(f"/providers/proxy/{provider_pk}/")
        put(
            f"/providers/proxy/{provider_pk}/",
            {**existing, **provider_body},
        )
        print(f"{APP_NAME} application exists; proxy provider settings synced.")
        return provider_pk, app["pk"]
    except requests.HTTPError as exc:
        if exc.response is not None and exc.response.status_code != 404:
            raise

    print(f"Creating {APP_NAME} provider and application...")
    provider_pk = int(post("/providers/proxy/", provider_body)["pk"])
    app_pk = post(
        "/core/applications/",
        {"name": APP_NAME, "slug": APP_SLUG, "provider": provider_pk},
    )["pk"]
    return provider_pk, app_pk


def ensure_group_binding(app_pk: str, group_pk: str) -> None:
    bindings = get(f"/policies/bindings/?target={app_pk}")["results"]
    if any(b.get("group") == group_pk for b in bindings):
        print(f"Group binding for {GROUP_NAME} already present.")
        return
    post(
        "/policies/bindings/",
        {"target": app_pk, "group": group_pk, "order": 0, "enabled": True},
    )
    print(f"Bound {GROUP_NAME} to {APP_NAME} application.")


def ensure_docker_outpost(provider_pk: int) -> None:
    outpost = get(f"/outposts/instances/{DOCKER_OUTPOST_PK}/")
    providers = list(outpost.get("providers") or [])
    if provider_pk not in providers:
        providers.append(provider_pk)
    patch(
        f"/outposts/instances/{DOCKER_OUTPOST_PK}/",
        {"providers": providers, "config": {**OUTPOST_CONFIG, **(outpost.get("config") or {})}},
    )
    print(f"Updated {DOCKER_OUTPOST_NAME} with {APP_NAME} provider.")


def outpost_api_token() -> str:
    token_id = f"ak-outpost-{DOCKER_OUTPOST_PK}-api"
    key_resp = requests.get(
        f"{AUTHENTIK_URL}/core/tokens/{token_id}/view_key/",
        headers=api_headers(),
        timeout=30,
    )
    key_resp.raise_for_status()
    return key_resp.json()["key"]


def sync_coolify_envs(updates: dict[str, str], *, restart: bool) -> None:
    if not COOLIFY_APP_UUID:
        print("Set COOLIFY_APARTMENT_STATS_APP_UUID to sync Coolify envs.", file=sys.stderr)
        sys.exit(1)
    token = coolify_token()
    if not token:
        print("Set COOLIFY_API_KEY (or COOLIFY_API_TOKEN).", file=sys.stderr)
        sys.exit(1)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    envs = requests.get(
        f"{COOLIFY_API}/applications/{COOLIFY_APP_UUID}/envs", headers=headers, timeout=30
    ).json()
    existing = {e.get("key") for e in envs}
    for key, value in updates.items():
        if key not in existing:
            for is_preview in (False, True):
                requests.post(
                    f"{COOLIFY_API}/applications/{COOLIFY_APP_UUID}/envs",
                    headers=headers,
                    json={
                        "key": key,
                        "value": value,
                        "is_preview": is_preview,
                        "is_literal": True,
                    },
                    timeout=30,
                )
    bulk = [
        {"key": key, "value": value, "is_preview": e.get("is_preview", False)}
        for e in requests.get(
            f"{COOLIFY_API}/applications/{COOLIFY_APP_UUID}/envs", headers=headers, timeout=30
        ).json()
        for key, value in updates.items()
        if e.get("key") == key
    ]
    if bulk:
        requests.patch(
            f"{COOLIFY_API}/applications/{COOLIFY_APP_UUID}/envs/bulk",
            headers=headers,
            json={"data": bulk},
            timeout=30,
        ).raise_for_status()
    if restart:
        requests.get(
            f"{COOLIFY_API}/applications/{COOLIFY_APP_UUID}/restart", headers=headers, timeout=60
        )
    print(
        f"Coolify envs updated: {', '.join(updates)}"
        f"{' (restart queued)' if restart else ''}."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sync-coolify", action="store_true")
    args = parser.parse_args()

    group_pk = ensure_group()
    ensure_user_in_group(group_pk)
    provider_pk, app_pk = ensure_provider()
    ensure_group_binding(app_pk, group_pk)
    ensure_docker_outpost(provider_pk)

    token = outpost_api_token()
    print("\nOutpost token ready for Coolify AUTHENTIK_TOKEN.")
    if args.sync_coolify:
        sync_coolify_envs(
            {"AUTHENTIK_TOKEN": token},
            restart=True,
        )


if __name__ == "__main__":
    main()
