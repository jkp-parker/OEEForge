"""OEEForge OEE Calculation Service — entrypoint."""
import logging
import signal
import sys
import time

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from config import settings
from scheduler.tasks import run_calculations

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    logger.info(
        f"OEE Calculation Service starting — interval: {settings.OEE_CALC_INTERVAL_SECONDS}s"
    )

    scheduler = BackgroundScheduler()
    scheduler.add_job(
        run_calculations,
        trigger=IntervalTrigger(seconds=settings.OEE_CALC_INTERVAL_SECONDS),
        id="oee_calc",
        name="OEE Calculation",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()

    # Run once immediately on startup
    try:
        run_calculations()
    except Exception as e:
        logger.error(f"Initial OEE run failed: {e}")

    def shutdown(signum, frame):
        logger.info("Shutting down OEE service...")
        scheduler.shutdown(wait=False)
        sys.exit(0)

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    try:
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()


if __name__ == "__main__":
    main()
