import base64
import io
import json
import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from apps.backend.app.security import current_user_id


def access_token(aal: str) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"aal": aal}).encode()).decode().rstrip("=")
    return f"header.{payload}.signature"


class AuthResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


def credentials(aal: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=access_token(aal))


class MfaAuthorizationTests(unittest.TestCase):
    def auth_response(self, user_id, factors):
        return AuthResponse(json.dumps({"id": str(user_id), "factors": factors}).encode())

    def test_aal1_is_allowed_when_user_has_no_verified_factor(self):
        user_id = uuid4()
        with patch(
            "apps.backend.app.security.urlopen",
            return_value=self.auth_response(user_id, []),
        ):
            self.assertEqual(current_user_id(credentials("aal1")), user_id)

    def test_aal1_is_blocked_when_user_has_a_verified_factor(self):
        user_id = uuid4()
        factors = [{"id": str(uuid4()), "factor_type": "totp", "status": "verified"}]
        with patch(
            "apps.backend.app.security.urlopen",
            return_value=self.auth_response(user_id, factors),
        ):
            with self.assertRaises(HTTPException) as context:
                current_user_id(credentials("aal1"))

        self.assertEqual(context.exception.status_code, 403)
        self.assertEqual(context.exception.detail, "MFA verification required")

    def test_unverified_enrollment_does_not_lock_the_user_out(self):
        user_id = uuid4()
        factors = [{"id": str(uuid4()), "factor_type": "totp", "status": "unverified"}]
        with patch(
            "apps.backend.app.security.urlopen",
            return_value=self.auth_response(user_id, factors),
        ):
            self.assertEqual(current_user_id(credentials("aal1")), user_id)

    def test_aal2_is_allowed_when_user_has_a_verified_factor(self):
        user_id = uuid4()
        factors = [{"id": str(uuid4()), "factor_type": "totp", "status": "verified"}]
        with patch(
            "apps.backend.app.security.urlopen",
            return_value=self.auth_response(user_id, factors),
        ):
            self.assertEqual(current_user_id(credentials("aal2")), user_id)


if __name__ == "__main__":
    unittest.main()
