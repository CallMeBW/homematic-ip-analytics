#!/usr/bin/env python3
"""Create Coolify docker-compose app for apartment-stats.brianwirth.de."""
from __future__ import annotations

import os
import sys

import requests

BASE = (
    os.environ["COOLIFY_BASE_URL"].rstrip("/") + "/api/v1"
    if os.environ.get("COOLIFY_BASE_URL")
    else "https://coolify.brianwirth.de/api/v1"
)
HEADERS = {
    "Authorization": f"Bearer {os.environ['COOLIFY_API_KEY']}",
    "Content-Type": "application/json",
}

SERVER_UUID = "bcr6ur88n80qpm4fxb7r1kna"
PRIVATE_KEY_UUID = "vs51yu411q5oy4ifzm4m0u53"
PROJECT_NAME = "Apartment Stats"
APP_NAME = "apartment-stats"
REPO = "git@github.com:CallMeBW/homematic-ip-analytics.git"
DOMAIN = "https://apartment-stats.brianwirth.de"


def get_json(path: str):
    response = requests.get(f"{BASE}{path}", headers=HEADERS, timeout=60)
    response.raise_for_status()
    return response.json()


def post_json(path: str, payload: dict):
    response = requests.post(f"{BASE}{path}", headers=HEADERS, json=payload, timeout=60)
    print(path, response.status_code, response.text[:1000])
    response.raise_for_status()
    return response.json() if response.text.strip() else {}


def ensure_project() -> tuple[str, str]:
    projects = get_json("/projects")
    project = next((item for item in projects if item.get("name") == PROJECT_NAME), None)
    if not project:
        project = post_json(
            "/projects",
            {"name": PROJECT_NAME, "description": "Homematic IP apartment climate analytics"},
        )
    detail = get_json(f"/projects/{project['uuid']}")
    environment = detail["environments"][0]
    return project["uuid"], environment["uuid"]


def create_app(project_uuid: str, environment_uuid: str) -> dict:
    payload = {
        "project_uuid": project_uuid,
        "server_uuid": SERVER_UUID,
        "environment_name": "production",
        "environment_uuid": environment_uuid,
        "private_key_uuid": PRIVATE_KEY_UUID,
        "git_repository": REPO,
        "git_branch": "main",
        "build_pack": "dockercompose",
        "docker_compose_location": "/docker-compose.yml",
        "name": APP_NAME,
        "description": f"Private climate analytics at {DOMAIN}",
        "instant_deploy": False,
        "ports_exposes": "80",
    }
    for path in [
        "/applications/private-deploy-key",
        "/applications/private-github-deploy-key",
        "/applications/private-key",
        "/applications",
    ]:
        try:
            return post_json(path, payload)
        except requests.HTTPError:
            continue
    raise SystemExit("Failed to create Coolify application via API")


def main() -> None:
    existing = next((app for app in get_json("/applications") if app.get("name") == APP_NAME), None)
    if existing:
        print(f"Application already exists: {existing['uuid']}")
        print(existing["uuid"])
        return
    project_uuid, environment_uuid = ensure_project()
    created = create_app(project_uuid, environment_uuid)
    uuid = created.get("uuid", created)
    print("Created:", uuid)


if __name__ == "__main__":
    if "COOLIFY_API_KEY" not in os.environ:
        sys.exit("Set COOLIFY_API_KEY")
    main()
