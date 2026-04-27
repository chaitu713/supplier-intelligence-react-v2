from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .core.exceptions import register_exception_handlers
from .core.logging import configure_logging, get_logger
from .routers.analytics import router as analytics_router
from .routers.advisor import router as advisor_router
from .routers.datasets import router as datasets_router
from .routers.auditing import router as auditing_router
from .routers.health import router as health_router
from .routers.onboarding_router import router as onboarding_router
from .routers.risk import router as risk_router
from .routers.simulator import router as simulator_router
from .routers.traceability import router as traceability_router

configure_logging()
logger = get_logger(__name__)
settings = get_settings()


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(application)
    application.include_router(health_router)
    application.include_router(datasets_router)
    application.include_router(auditing_router)
    application.include_router(analytics_router)
    application.include_router(advisor_router)
    application.include_router(risk_router)
    application.include_router(simulator_router)
    application.include_router(onboarding_router)
    application.include_router(traceability_router)

    logger.info("FastAPI application configured")
    return application


app = create_app()
