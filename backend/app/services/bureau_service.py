"""
NexLoan Bureau Service — Credit Bureau Integration Layer
Currently in SIMULATION mode. Swap to real API when commercial agreement is in place.
"""

import logging
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.loan import BureauScore

logger = logging.getLogger("nexloan.bureau")


class BureauService:
    """
    Abstraction layer for credit bureau integration.
    Currently in SIMULATION mode.
    When a real bureau API is integrated, only this file needs to change.
    """

    async def fetch_score(
        self,
        pan_number: str,
        dob: str,
        name: str,
        loan_id: str,
        user_id: str,
        db: AsyncSession,
    ) -> dict:
        """
        Fetches bureau score. Currently simulates based on PAN number.
        In production: replace with actual CIBIL/Experian API call.
        """
        mode = settings.BUREAU_MODE
        if mode == "simulated":
            return await self._simulate_bureau_score(pan_number, loan_id, user_id, db)
        elif mode == "cibil":
            return await self._fetch_cibil(pan_number, dob, name)
        elif mode == "experian":
            return await self._fetch_experian(pan_number, dob, name)
        else:
            raise ValueError(f"Unknown bureau mode: {mode}")

    async def _simulate_bureau_score(
        self, pan_number: str, loan_id: str, user_id: str, db: AsyncSession
    ) -> dict:
        """
        Deterministic simulation: same PAN always gets same score.
        Uses PAN character sum to generate a consistent score.
        """
        char_sum = sum(ord(c) for c in pan_number)
        simulated_score = 550 + (char_sum % 300)

        bureau_record = BureauScore(
            loan_id=loan_id,
            user_id=user_id,
            bureau_name="SIMULATED",
            bureau_score=simulated_score,
            bureau_report={"simulated": True, "pan_hash": str(hash(pan_number))},
            is_simulated=True,
        )
        db.add(bureau_record)

        logger.info(f"📊 Simulated bureau score for PAN {pan_number[:4]}****: {simulated_score}")

        return {"score": simulated_score, "bureau": "SIMULATED", "is_simulated": True}

    async def _fetch_cibil(self, pan: str, dob: str, name: str) -> dict:
        """Placeholder for CIBIL TransUnion API integration."""
        raise NotImplementedError(
            "CIBIL integration requires a commercial agreement. "
            "Contact Theoremlabs for production setup."
        )

    async def _fetch_experian(self, pan: str, dob: str, name: str) -> dict:
        """Placeholder for Experian API integration."""
        raise NotImplementedError(
            "Experian integration requires a commercial agreement. "
            "Contact Theoremlabs for production setup."
        )

    def blend_scores(
        self,
        theoremlabs_score: int,
        bureau_score: int,
        bureau_weight: float = 0.4,
    ) -> int:
        """
        Blends Theoremlabs score with bureau score.
        Default: 60% Theoremlabs + 40% Bureau.
        """
        bureau_normalized = int(300 + (bureau_score - 300) * (550 / 600))
        blended = int(
            theoremlabs_score * (1 - bureau_weight) +
            bureau_normalized * bureau_weight
        )
        return max(300, min(850, blended))


# Singleton instance
bureau_service = BureauService()
