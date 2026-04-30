"""
NexLoan RBAC Permission System — prompt4.md Phase 5
Full role matrix including VERIFIER and UNDERWRITER.
"""

from enum import Enum as PyEnum
from fastapi import HTTPException, status, Depends
from datetime import datetime
from sqlalchemy import select
from app.utils.auth import get_current_user
from app.utils.database import AsyncSessionLocal


class Permission(str, PyEnum):
    """All permissions in the NexLoan system per prompt4.md Part 4.2."""
    # Borrower permissions
    VIEW_OWN_LOAN        = "VIEW_OWN_LOAN"
    SUBMIT_APPLICATION   = "SUBMIT_APPLICATION"
    REQUEST_CALLBACK     = "REQUEST_CALLBACK"
    RAISE_TICKET         = "RAISE_TICKET"
    # Loan Officer permissions
    VIEW_ALL_LOANS       = "VIEW_ALL_LOANS"
    LOAN_DISBURSE        = "LOAN_DISBURSE"
    MARK_EMI_PAID        = "MARK_EMI_PAID"
    CLOSE_LOAN           = "CLOSE_LOAN"
    VIEW_DASHBOARD_OPS   = "VIEW_DASHBOARD_OPS"
    VIEW_ENQUIRIES       = "VIEW_ENQUIRIES"
    ENQUIRY_MANAGE       = "ENQUIRY_MANAGE"
    # Verifier permissions
    KYC_APPROVE          = "KYC_APPROVE"
    KYC_REJECT           = "KYC_REJECT"
    VERIFY_COLLATERAL    = "VERIFY_COLLATERAL"
    # Underwriter permissions
    UNDERWRITING_RUN     = "UNDERWRITING_RUN"
    APPROVE_LOAN         = "APPROVE_LOAN"
    # Admin permissions
    VIEW_ADMIN_METRICS   = "VIEW_ADMIN_METRICS"
    EDIT_TENANT_CONFIG   = "EDIT_TENANT_CONFIG"
    CREATE_EMPLOYEES     = "CREATE_EMPLOYEES"
    DELEGATE_ADMIN       = "DELEGATE_ADMIN"
    MANAGE_ANNOUNCEMENTS = "MANAGE_ANNOUNCEMENTS"
    ANNOUNCEMENT_CREATE  = "ANNOUNCEMENT_CREATE"
    USER_MANAGE          = "USER_MANAGE"
    CHANGE_SETTINGS      = "CHANGE_SETTINGS"
    TOGGLE_PRECLOSURE    = "TOGGLE_PRECLOSURE"
    # Super Admin only
    MANAGE_ROLES         = "MANAGE_ROLES"


# Permission matrix per prompt4.md Part 4.2
PERMISSION_MATRIX: dict[str, set[Permission]] = {
    "BORROWER": {
        Permission.VIEW_OWN_LOAN,
        Permission.SUBMIT_APPLICATION,
        Permission.REQUEST_CALLBACK,
        Permission.RAISE_TICKET,
    },
    "LOAN_OFFICER": {
        Permission.VIEW_OWN_LOAN,
        Permission.VIEW_ALL_LOANS,
        Permission.LOAN_DISBURSE,
        Permission.MARK_EMI_PAID,
        Permission.CLOSE_LOAN,
        Permission.VIEW_DASHBOARD_OPS,
        Permission.VIEW_ENQUIRIES,
        Permission.ENQUIRY_MANAGE,
    },
    "VERIFIER": {
        Permission.VIEW_OWN_LOAN,
        Permission.VIEW_ALL_LOANS,
        Permission.KYC_APPROVE,
        Permission.KYC_REJECT,
        Permission.VERIFY_COLLATERAL,
        Permission.VIEW_DASHBOARD_OPS,
    },
    "UNDERWRITER": {
        Permission.VIEW_OWN_LOAN,
        Permission.VIEW_ALL_LOANS,
        Permission.UNDERWRITING_RUN,
        Permission.APPROVE_LOAN,
        Permission.VIEW_DASHBOARD_OPS,
    },
    "ADMIN": {
        Permission.VIEW_OWN_LOAN,
        Permission.VIEW_ALL_LOANS,
        Permission.LOAN_DISBURSE,
        Permission.MARK_EMI_PAID,
        Permission.CLOSE_LOAN,
        Permission.KYC_APPROVE,
        Permission.KYC_REJECT,
        Permission.VERIFY_COLLATERAL,
        Permission.UNDERWRITING_RUN,
        Permission.APPROVE_LOAN,
        Permission.VIEW_DASHBOARD_OPS,
        Permission.VIEW_ADMIN_METRICS,
        Permission.EDIT_TENANT_CONFIG,
        Permission.CREATE_EMPLOYEES,
        Permission.DELEGATE_ADMIN,
        Permission.MANAGE_ANNOUNCEMENTS,
        Permission.ANNOUNCEMENT_CREATE,
        Permission.USER_MANAGE,
        Permission.CHANGE_SETTINGS,
        Permission.TOGGLE_PRECLOSURE,
        Permission.VIEW_ENQUIRIES,
        Permission.ENQUIRY_MANAGE,
    },
    "SUPER_ADMIN": {
        Permission.VIEW_OWN_LOAN,
        Permission.SUBMIT_APPLICATION,
        Permission.VIEW_ALL_LOANS,
        Permission.LOAN_DISBURSE,
        Permission.MARK_EMI_PAID,
        Permission.CLOSE_LOAN,
        Permission.KYC_APPROVE,
        Permission.KYC_REJECT,
        Permission.VERIFY_COLLATERAL,
        Permission.UNDERWRITING_RUN,
        Permission.APPROVE_LOAN,
        Permission.VIEW_DASHBOARD_OPS,
        Permission.VIEW_ADMIN_METRICS,
        Permission.EDIT_TENANT_CONFIG,
        Permission.CREATE_EMPLOYEES,
        Permission.DELEGATE_ADMIN,
        Permission.MANAGE_ANNOUNCEMENTS,
        Permission.ANNOUNCEMENT_CREATE,
        Permission.USER_MANAGE,
        Permission.CHANGE_SETTINGS,
        Permission.TOGGLE_PRECLOSURE,
        Permission.MANAGE_ROLES,
        Permission.VIEW_ENQUIRIES,
        Permission.ENQUIRY_MANAGE,
        Permission.REQUEST_CALLBACK,
        Permission.RAISE_TICKET,
    },
}


def get_user_permissions(role: str) -> set[Permission]:
    """Get the permissions for a given role."""
    return PERMISSION_MATRIX.get(role, set())


async def check_delegation(user_id: str) -> set[Permission]:
    """Check if user has any active delegated permissions."""
    try:
        from app.models.loan import AdminDelegation
        async with AsyncSessionLocal() as db:
            now = datetime.utcnow()
            result = await db.execute(
                select(AdminDelegation).where(
                    AdminDelegation.delegate_id == user_id,
                    AdminDelegation.is_active == True,
                    AdminDelegation.start_date <= now,
                    AdminDelegation.end_date >= now,
                )
            )
            delegations = result.scalars().all()
            extra_perms: set[Permission] = set()
            for d in delegations:
                perms_field = getattr(d, 'delegated_permissions', None) or getattr(d, 'permissions', None) or []
                for p in perms_field:
                    try:
                        extra_perms.add(Permission(p))
                    except ValueError:
                        pass
            return extra_perms
    except Exception:
        return set()


def require_permission(*permissions: Permission):
    """
    FastAPI dependency — checks if current user has ALL required permissions,
    including delegated ones. Raises 403 if any are missing.
    """
    async def _check(current_user=Depends(get_current_user)):
        user_role = getattr(current_user, 'role', 'BORROWER') or 'BORROWER'
        role_perms = get_user_permissions(user_role)

        user_id = str(getattr(current_user, 'id', ''))
        if user_id:
            delegated = await check_delegation(user_id)
            role_perms = role_perms | delegated

        missing = set(permissions) - role_perms
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Missing: {[p.value for p in missing]}",
            )
        return current_user

    return _check


def require_role(*roles: str):
    """Simple role-check dependency."""
    async def _check(current_user=Depends(get_current_user)):
        user_role = getattr(current_user, 'role', 'BORROWER') or 'BORROWER'
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {list(roles)}",
            )
        return current_user
    return _check
