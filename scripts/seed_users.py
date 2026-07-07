import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import DB_PATH
from app.database import Database
from app.palm_processor import PalmProcessor
from app.services.seed_users import seed_system_register_users_from_directory, seed_users_from_directory


def main():
    parser = argparse.ArgumentParser(description="Seed PalmGate users from named full-hand images.")
    parser.add_argument("seed_dir", nargs="?", default="seeds")
    parser.add_argument("--db", default=str(DB_PATH))
    parser.add_argument("--replace-users", action="store_true")
    parser.add_argument(
        "--auto-demo-nim",
        action="store_true",
        help="Testing only: accept plain labels and generate stable SEED-001 demo NIMs.",
    )
    parser.add_argument(
        "--system-register-layout",
        action="store_true",
        help="Import folders named '<name>_L'/'<name>_R' as separate left/right users with NIMs like 1-L and 1-R.",
    )
    args = parser.parse_args()
    if args.system_register_layout and args.auto_demo_nim:
        parser.error("--auto-demo-nim cannot be used with --system-register-layout")

    db = Database(args.db)
    palm_processor = PalmProcessor()
    try:
        if args.system_register_layout:
            summary = seed_system_register_users_from_directory(
                args.seed_dir,
                db,
                palm_processor,
                replace_users=args.replace_users,
            )
        else:
            summary = seed_users_from_directory(
                args.seed_dir,
                db,
                palm_processor,
                replace_users=args.replace_users,
                auto_demo_nim=args.auto_demo_nim,
            )
        for name in summary.created:
            print(f"CREATED {name}")
        for name in summary.skipped:
            print(f"SKIPPED {name}")
        for name, error in summary.failed.items():
            print(f"FAILED {name}: {error}")
        if summary.failed:
            raise SystemExit(1)
    finally:
        palm_processor.close()
        db.close()


if __name__ == "__main__":
    main()
