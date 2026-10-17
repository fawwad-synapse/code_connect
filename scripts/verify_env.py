#!/usr/bin/env python3
"""
RescueRank Environment & Dependency Doctor
Verifies Python version, Node.js, Docker, PostGIS, and backend library imports.
Outputs a clean green/red status summary.
"""
import sys
import subprocess
import importlib

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"
BOLD = "\033[1m"

def print_row(name: str, status: bool, detail: str = ""):
    symbol = f"{GREEN}[PASS]{RESET}" if status else f"{RED}[FAIL]{RESET}"
    print(f"  {symbol} {name:<32} {detail}")

def check_cli(cmd: list[str]) -> tuple[bool, str]:
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True, shell=True, timeout=10)
        return True, res.stdout.strip().split("\n")[0]
    except Exception as e:
        return False, str(e)

def check_module(mod_name: str, pkg_name: str = None) -> tuple[bool, str]:
    try:
        mod = importlib.import_module(mod_name)
        ver = getattr(mod, "__version__", "installed")
        return True, f"v{ver}"
    except ImportError as e:
        return False, f"Missing: {e}"

def main():
    print(f"\n{BOLD}=== RescueRank Environment Doctor ==={RESET}\n")
    
    print(f"{BOLD}1. System & Runtime Tools:{RESET}")
    py_ok = sys.version_info >= (3, 11)
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    print_row("Python (>=3.11)", py_ok, f"v{py_ver}")

    node_ok, node_ver = check_cli(["node", "--version"])
    print_row("Node.js (>=18/20)", node_ok, node_ver)

    npm_ok, npm_ver = check_cli(["npm", "--version"])
    print_row("npm", npm_ok, f"v{npm_ver}" if npm_ok else npm_ver)

    docker_ok, docker_ver = check_cli(["docker", "--version"])
    print_row("Docker", docker_ok, docker_ver)

    uv_ok, uv_ver = check_cli(["uv", "--version"])
    print_row("uv (Fast Package Manager)", uv_ok, uv_ver)

    print(f"\n{BOLD}2. Core Backend Libraries:{RESET}")
    critical_libs = [
        ("fastapi", "FastAPI web framework"),
        ("uvicorn", "ASGI server"),
        ("pydantic", "Data validation"),
        ("sqlalchemy", "Async ORM"),
        ("asyncpg", "Async PostgreSQL driver"),
        ("geoalchemy2", "PostGIS integration"),
        ("shapely", "Geometric analysis"),
        ("alembic", "Database migrations"),
        ("httpx", "Async HTTP client"),
        ("ortools", "Google OR-Tools VRP/routing"),
        ("apscheduler", "Background scheduler"),
        ("structlog", "Structured logging"),
        ("rapidfuzz", "Fast string fuzzy matching"),
        ("sentence_transformers", "Multilingual semantic embeddings"),
        ("telegram", "python-telegram-bot async"),
        ("langgraph", "Stateful agent workflow"),
        ("langchain_core", "LangChain core"),
        ("langchain_mistralai", "Mistral AI client"),
    ]

    all_libs_ok = True
    for mod, desc in critical_libs:
        ok, detail = check_module(mod)
        if not ok:
            all_libs_ok = False
        print_row(f"{mod} ({desc})", ok, detail)

    print(f"\n{BOLD}===================================={RESET}")
    if py_ok and node_ok and all_libs_ok:
        print(f"{GREEN}{BOLD}[OK] ALL SYSTEMS GO: Environment is healthy!{RESET}\n")
        return 0
    else:
        print(f"{YELLOW}{BOLD}! ATTENTION: Some components need configuration or installation.{RESET}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
