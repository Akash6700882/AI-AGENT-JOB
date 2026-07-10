"""
Tests for ai_agent.py — the Phase 0B LLM layer.

Run with: pytest tests/test_ai_agent.py -v
(from app/backend/, with dependencies from requirements.txt installed)

No real API key or network access is used anywhere in this file — the
Anthropic client is always a fake/mock. That's deliberate: these tests
must run in CI without secrets and without hitting a paid API.
"""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
import ai_agent


class FakeTextBlock:
    def __init__(self, text):
        self.type = "text"
        self.text = text


class FakeUsage:
    def __init__(self, input_tokens=10, output_tokens=20):
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens


class FakeAnthropicResponse:
    def __init__(self, text, input_tokens=10, output_tokens=20):
        self.content = [FakeTextBlock(text)]
        self.usage = FakeUsage(input_tokens, output_tokens)


class FakeMessages:
    """Queue of canned responses OR a raiser function, so tests can drive
    either the happy path or specific error paths."""
    def __init__(self, responses=None, raises=None):
        self._responses = responses or []
        self._raises = raises
        self._i = 0
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self._raises is not None:
            raise self._raises
        r = self._responses[self._i % len(self._responses)]
        self._i += 1
        return FakeAnthropicResponse(r) if isinstance(r, str) else r


class FakeAnthropicClient:
    def __init__(self, responses=None, raises=None, **kwargs):
        self.messages = FakeMessages(responses=responses, raises=raises)


class FakeResume:
    def __init__(self, skills=None, experience=None, education=None, summary=""):
        self.skills = skills or []
        self.experience = experience or []
        self.education = education or []
        self.summary = summary


class FakeJob:
    def __init__(self, title="Backend Engineer", company="Acme", description="A backend role"):
        self.id = "job-1"
        self.title = title
        self.company = company
        self.description = description


class FakeMatchResult:
    def __init__(self, matched_skills=None, missing_skills=None, related_skills=None, overall_score=80.0):
        self.job = FakeJob()
        self.overall_score = overall_score
        self.matched_skills = matched_skills or []
        self.missing_skills = missing_skills or []
        self.related_skills = related_skills or []


def make_llm(responses=None, raises=None):
    """Builds a CareerPilotLLM with enabled=True and a fake client injected,
    bypassing the real ANTHROPIC_API_KEY / anthropic.Anthropic() call."""
    llm = ai_agent.CareerPilotLLM(api_key="fake-key-for-test")
    llm.enabled = True
    llm.client = FakeAnthropicClient(responses=responses, raises=raises)
    return llm


# ---------------------------------------------------------------------------
# Fail-soft behavior
# ---------------------------------------------------------------------------

def test_disabled_without_api_key():
    llm = ai_agent.CareerPilotLLM(api_key=None)
    assert llm.enabled is False
    result = llm.enrich_resume(FakeResume(skills=["python"]))
    assert result.generated_by == "unavailable"


def test_disabled_without_anthropic_package(monkeypatch):
    monkeypatch.setattr(ai_agent, "_ANTHROPIC_AVAILABLE", False)
    llm = ai_agent.CareerPilotLLM(api_key="fake-key")
    assert llm.enabled is False


def test_malformed_json_response_falls_back():
    llm = make_llm(responses=["this is not json"])
    result = llm.enrich_resume(FakeResume(skills=["python"]))
    assert result.generated_by == "unavailable"


def test_fenced_json_response_is_handled():
    payload = json.dumps({
        "seniority_level": "mid", "primary_domain": "backend",
        "career_narrative": "x", "key_strengths": ["python"], "potential_gaps": []
    })
    llm = make_llm(responses=["```json\n" + payload + "\n```"])
    result = llm.enrich_resume(FakeResume(skills=["python"]))
    assert result.generated_by == "llm"
    assert result.seniority_level == "mid"


def test_api_error_types_fall_back_cleanly():
    """Every Anthropic error type must result in a clean 'unavailable'
    result, never a raised exception reaching the caller."""
    import anthropic as real_anthropic

    errors_to_test = [
        real_anthropic.APIConnectionError(request=None),
        real_anthropic.APITimeoutError(request=None),
    ]
    for err in errors_to_test:
        llm = make_llm(raises=err)
        result = llm.enrich_resume(FakeResume(skills=["python"]))
        assert result.generated_by == "unavailable", f"failed for {type(err).__name__}"


# ---------------------------------------------------------------------------
# Grounding / hallucination prevention
# ---------------------------------------------------------------------------

def test_enrich_resume_drops_ungrounded_key_strengths():
    """The model claims a 'kubernetes' strength but the resume's actual
    skill list doesn't include kubernetes — that claim must be dropped."""
    payload = json.dumps({
        "seniority_level": "mid",
        "primary_domain": "backend",
        "career_narrative": "A backend engineer.",
        "key_strengths": ["python", "kubernetes"],   # kubernetes NOT in resume.skills
        "potential_gaps": [],
    })
    llm = make_llm(responses=[payload])
    resume = FakeResume(skills=["python", "fastapi"])  # no kubernetes
    result = llm.enrich_resume(resume)

    assert result.generated_by == "llm"
    assert "kubernetes" not in " ".join(result.key_strengths).lower()
    assert any("python" in s.lower() for s in result.key_strengths)


def test_enrich_resume_keeps_grounded_strengths():
    payload = json.dumps({
        "seniority_level": "mid", "primary_domain": "backend",
        "career_narrative": "x",
        "key_strengths": ["python", "fastapi"],
        "potential_gaps": ["docker"],   # docker also not in resume.skills -> dropped
    })
    llm = make_llm(responses=[payload])
    resume = FakeResume(skills=["python", "fastapi"])
    result = llm.enrich_resume(resume)

    assert set(s.lower() for s in result.key_strengths) == {"python", "fastapi"}
    assert result.potential_gaps == []  # docker claim was dropped


def test_explain_match_discards_ungrounded_reasoning():
    """The model's reasoning mentions 'kubernetes', which isn't in this
    job's matched/missing/related skill lists — the whole explanation
    must be discarded rather than shown."""
    payload = json.dumps({
        "reasoning": "Strong match on python and kubernetes experience.",
        "confidence": "high",
    })
    llm = make_llm(responses=[payload])
    match = FakeMatchResult(matched_skills=["python"], missing_skills=[], related_skills=[])
    result = llm.explain_match(FakeResume(skills=["python"]), match)

    assert result.generated_by == "flagged_ungrounded"
    assert result.reasoning == ""


def test_explain_match_keeps_grounded_reasoning():
    payload = json.dumps({
        "reasoning": "Strong match on python and fastapi experience.",
        "confidence": "high",
    })
    llm = make_llm(responses=[payload])
    match = FakeMatchResult(matched_skills=["python", "fastapi"], missing_skills=[], related_skills=[])
    result = llm.explain_match(FakeResume(skills=["python", "fastapi"]), match)

    assert result.generated_by == "llm"
    assert "python" in result.reasoning.lower()


def test_confidence_defaults_to_unknown_for_bad_value():
    payload = json.dumps({"reasoning": "ok match", "confidence": "extremely high"})
    llm = make_llm(responses=[payload])
    match = FakeMatchResult(matched_skills=[], missing_skills=[], related_skills=[])
    result = llm.explain_match(FakeResume(), match)
    assert result.confidence == "unknown"


# ---------------------------------------------------------------------------
# Configuration (model / temperature / tokens / timeout / retries via env)
# ---------------------------------------------------------------------------

def test_config_is_environment_driven(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_MODEL", "claude-test-model")
    monkeypatch.setenv("ANTHROPIC_TEMPERATURE", "0.5")
    monkeypatch.setenv("ANTHROPIC_TIMEOUT_SECONDS", "5")
    monkeypatch.setenv("ANTHROPIC_MAX_RETRIES", "3")

    # Re-read module-level env-derived constants the way a fresh process would.
    import importlib
    importlib.reload(ai_agent)

    llm = ai_agent.CareerPilotLLM(api_key="fake-key")
    assert llm.model == "claude-test-model"
    assert llm.temperature == 0.5
    assert llm.timeout == 5.0
    assert llm.max_retries == 3

    # cleanup: reload again without the monkeypatched env so later tests
    # in the same process see real defaults
    monkeypatch.undo()
    importlib.reload(ai_agent)


def test_invalid_env_value_falls_back_to_default(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_TEMPERATURE", "not-a-number")
    assert ai_agent._env_float("ANTHROPIC_TEMPERATURE", 0.0) == 0.0


# ---------------------------------------------------------------------------
# Security: secret redaction
# ---------------------------------------------------------------------------

def test_redact_secrets_scrubs_api_key_like_strings():
    fake_key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789"
    message = f"Authentication failed for key {fake_key}"
    redacted = ai_agent._redact_secrets(message)
    assert fake_key not in redacted
    assert "REDACTED" in redacted


def test_redact_secrets_leaves_normal_text_alone():
    message = "Anthropic call timed out after 20.0s"
    assert ai_agent._redact_secrets(message) == message


# ---------------------------------------------------------------------------
# Prompt versioning
# ---------------------------------------------------------------------------

def test_prompts_are_versioned():
    assert "version" in ai_agent.PROMPTS["resume_enrichment"]
    assert "version" in ai_agent.PROMPTS["job_match_explanation"]


def test_generated_results_carry_prompt_version():
    payload = json.dumps({
        "seniority_level": "mid", "primary_domain": "backend",
        "career_narrative": "x", "key_strengths": [], "potential_gaps": []
    })
    llm = make_llm(responses=[payload])
    result = llm.enrich_resume(FakeResume(skills=["python"]))
    assert result.prompt_version == ai_agent.PROMPTS["resume_enrichment"]["version"]


# ---------------------------------------------------------------------------
# Cost optimization: resume hashing
# ---------------------------------------------------------------------------

def test_resume_hash_stable_for_identical_content():
    r1 = FakeResume(skills=["python", "fastapi"], summary="hi")
    r2 = FakeResume(skills=["fastapi", "python"], summary="hi")  # different order
    assert ai_agent.compute_resume_hash(r1) == ai_agent.compute_resume_hash(r2)


def test_resume_hash_changes_with_content():
    r1 = FakeResume(skills=["python"], summary="hi")
    r2 = FakeResume(skills=["python", "docker"], summary="hi")
    assert ai_agent.compute_resume_hash(r1) != ai_agent.compute_resume_hash(r2)