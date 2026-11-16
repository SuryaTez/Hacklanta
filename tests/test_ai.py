import json
import os
import tempfile
import unittest

from ai_service import AIServiceError, GeminiService, validate_analysis, validate_explanation
from server import load_dotenv


class FakeResponse:
    def __init__(self, value):
        self.text = json.dumps(value) if not isinstance(value, str) else value


class FakeModels:
    def __init__(self, response=None, error=None):
        self.response, self.error = response, error

    def generate_content(self, **kwargs):
        if self.error:
            raise self.error
        return FakeResponse(self.response)


class FakeClient:
    def __init__(self, response=None, error=None):
        self.models = FakeModels(response, error)


def valid_analysis():
    return {"objective": "Serve dinner", "peopleServed": 50, "location": "Atlanta", "deadlineText": "7 PM",
            "requirements": [{"category": "meal", "quantity": 50, "unit": "servings", "priority": "required"}],
            "dietaryTags": [], "refrigerationRequired": True, "transportationRequired": True, "budget": 100,
            "missingDetails": [], "ambiguities": [], "clarificationQuestions": []}


class GeminiServiceTests(unittest.TestCase):
    def test_root_relative_env_loading_uses_dummy_key(self):
        original_key = os.environ.pop("GEMINI_API_KEY", None)
        original_model = os.environ.pop("GEMINI_MODEL", None)
        try:
            with tempfile.TemporaryDirectory() as folder:
                env_path = os.path.join(folder, ".env")
                with open(env_path, "w", encoding="utf-8") as handle:
                    handle.write("GEMINI_API_KEY=dummy-test-key\nGEMINI_MODEL=dummy-model\n")
                load_dotenv(env_path)
                self.assertEqual(os.environ.get("GEMINI_API_KEY"), "dummy-test-key")
                self.assertEqual(os.environ.get("GEMINI_MODEL"), "dummy-model")
                service = GeminiService()
                self.assertTrue(service.api_key)
                self.assertEqual(service.model, "dummy-model")
        finally:
            os.environ.pop("GEMINI_API_KEY", None)
            os.environ.pop("GEMINI_MODEL", None)
            if original_key is not None:
                os.environ["GEMINI_API_KEY"] = original_key
            if original_model is not None:
                os.environ["GEMINI_MODEL"] = original_model

    def test_structured_analysis_and_missing_information(self):
        result = GeminiService(client=FakeClient(valid_analysis())).analyze("Serve dinner for 50 people in Atlanta")
        self.assertEqual(result["peopleServed"], 50)
        self.assertEqual(result["missingDetails"], [])

    def test_invalid_response_is_rejected(self):
        with self.assertRaises(AIServiceError) as caught:
            GeminiService(client=FakeClient("not json")).analyze("A sufficiently detailed mission request")
        self.assertEqual(caught.exception.code, "INVALID_AI_RESPONSE")

    def test_model_error_is_safe(self):
        with self.assertRaises(AIServiceError) as caught:
            GeminiService(client=FakeClient(error=RuntimeError("429 quota exceeded with secret details"))).analyze("A sufficiently detailed mission request")
        self.assertEqual(caught.exception.code, "AI_QUOTA")
        self.assertNotIn("secret", caught.exception.message)

    def test_sdk_auth_error_is_classified_without_details(self):
        from google.genai.errors import ClientError
        with self.assertRaises(AIServiceError) as caught:
            GeminiService(client=FakeClient(error=ClientError(401, {"error": {"message": "redacted"}}))).analyze("A sufficiently detailed mission request")
        self.assertEqual(caught.exception.code, "AI_AUTH")
        self.assertNotIn("redacted", caught.exception.message)

    def test_sdk_model_error_is_classified(self):
        from google.genai.errors import ClientError
        with self.assertRaises(AIServiceError) as caught:
            GeminiService(client=FakeClient(error=ClientError(404, {"error": {"message": "model not found"}}))).analyze("A sufficiently detailed mission request")
        self.assertEqual(caught.exception.code, "AI_PROVIDER_404")

    def test_explanation_filters_unknown_resource_ids(self):
        raw = {"matchExplanations": [{"resourceId": "known", "explanation": "Fits"}, {"resourceId": "hallucinated", "explanation": "No"}],
               "shortages": [], "risks": [{"severity": "Critical", "issue": "No deadline", "nextAction": "Confirm it"}]}
        result = validate_explanation(raw, {"known"})
        self.assertEqual([x["resourceId"] for x in result["matchExplanations"]], ["known"])

    def test_refinement_preserves_protected_fields(self):
        mission = {"id": "m1", "title": "Dinner", "people": 10, "budget": 100, "matches": [{"resourceId": "r1"}],
                   "contributions": [{"amount": 4}], "route": [{"id": "stop"}], "status": "Funded", "lat": 1, "lng": 2}
        changed = dict(mission, title="Dinner updated", people=20, matches=[], contributions=[], route=[], status="Draft", lat=9, lng=9)
        payload = {"proposedMission": changed, "changes": [{"field": "people", "oldValue": 10, "newValue": 20, "reason": "Requested"}], "clarificationQuestions": []}
        service = GeminiService(client=FakeClient(payload))
        result = service.refine(mission, "Change the number of people to 20")
        proposed = result["proposedMission"]
        self.assertEqual(proposed["people"], 20)
        self.assertEqual(proposed["matches"], mission["matches"])
        self.assertEqual(proposed["status"], mission["status"])


if __name__ == "__main__":
    unittest.main()
