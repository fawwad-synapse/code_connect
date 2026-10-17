import time
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.core.logging import logger
from app.services.scoring import PriorityScoreResult


def build_deterministic_explanation(result: PriorityScoreResult, context: Dict[str, Any]) -> str:
    """
    Produces a factual, transparent natural language justification
    from the mathematical factor breakdown. Zero LLM hallucination risk.
    """
    zone_name = context.get("zone_name", "Target Area")
    age = context.get("age", 45)
    mobility = context.get("mobility_impaired", False)
    medical = context.get("chronic_medical_need", False)
    housing = context.get("housing_type", "informal")
    depth = context.get("forecast_depth_m", 1.0)
    eta = context.get("eta_hours", 3.0)

    lines = []
    lines.append(
        f"Case ranked at priority score {result.priority_score}/100 ({result.summary_reason}) in {zone_name}."
    )

    # 1. Hazard rationale
    lines.append(
        f"Hazard exposure is {int(result.hazard_exposure * 100)}% based on {depth:.1f}m predicted flood inundation reaching location in approximately {eta:.1f} hours."
    )

    # 2. Demographic & Vulnerability rationale
    vuln_reasons = []
    if age >= 65:
        vuln_reasons.append(f"resident is elderly ({age} years old)")
    if mobility:
        vuln_reasons.append("mobility impaired (cannot self-evacuate)")
    if medical:
        vuln_reasons.append("has critical chronic medical dependencies")
    if housing == "informal":
        vuln_reasons.append("occupies fragile ground-floor informal housing susceptible to structural washout")

    if vuln_reasons:
        lines.append(f"Vulnerability is amplified because {', and '.join(vuln_reasons)}.")
    else:
        lines.append("Vulnerability score reflects standard demographic indicators.")

    # 3. Warning Gap rationale
    if result.warning_gap >= 0.6:
        lines.append(
            f"Digital warning gap is severe ({int(result.warning_gap * 100)}% disconnected), indicating official flood alerts have not been received or acknowledged."
        )

    # 4. Incomplete data & Conservative assumption notes
    if result.missing_fields_assumed:
        assumptions_str = ", ".join(result.missing_fields_assumed)
        lines.append(
            f"Conservative safety defaults applied due to missing survey data: [{assumptions_str}]. Confidence rating: {result.confidence_level} ({int(result.confidence * 100)}%)."
        )

    return " ".join(lines)


async def generate_explanation(result: PriorityScoreResult, context: Dict[str, Any]) -> str:
    """
    Generates natural language explanation. Uses LLM if API key is provided,
    otherwise instantly falls back to deterministic mathematical template.
    """
    start_time = time.time()
    fallback_text = build_deterministic_explanation(result, context)

    # Check if LLM provider key is available
    api_key = None
    if settings.LLM_PROVIDER == "openrouter":
        api_key = settings.OPENROUTER_API_KEY
    elif settings.LLM_PROVIDER == "mistral":
        api_key = settings.MISTRAL_API_KEY
    elif settings.LLM_PROVIDER == "groq":
        api_key = settings.GROQ_API_KEY
    elif settings.LLM_PROVIDER == "openai":
        api_key = settings.OPENAI_API_KEY

    if not api_key:
        logger.info("No LLM API key configured; using deterministic explanation template", provider="deterministic")
        return fallback_text

    try:
        from langchain_core.messages import SystemMessage, HumanMessage

        prompt = f"""You are an emergency operations coordinator explaining why a household was prioritized for disaster rescue.
State only the verified facts and numbers provided. Do not invent new factors or change any numerical scores.

Scoring Breakdown:
- Priority Score: {result.priority_score}/100
- Hazard Exposure: {result.hazard_exposure} (Depth: {context.get('forecast_depth_m')}m, ETA: {context.get('eta_hours')}h)
- Vulnerability: {result.vulnerability_index} (Age: {context.get('age')}, Mobility Impaired: {context.get('mobility_impaired')}, Medical Need: {context.get('chronic_medical_need')})
- Warning Gap: {result.warning_gap}
- Assumed Missing Fields: {result.missing_fields_assumed}
- Zone: {context.get('zone_name')}

Factual summary:
{fallback_text}

Rewrite this into 2-3 clear, professional sentences suitable for first responders."""

        messages = [
            SystemMessage(content="You are an explainable disaster response intelligence explainer."),
            HumanMessage(content=prompt),
        ]

        if settings.LLM_PROVIDER == "openrouter":
            from langchain_openai import ChatOpenAI
            llm = ChatOpenAI(
                model=settings.OPENROUTER_MODEL or "liquid/lfm-2.5-2.6b:free",
                openai_api_key=api_key,
                openai_api_base="https://openrouter.ai/api/v1",
                temperature=0.1,
                timeout=10.0,
            )
        elif settings.LLM_PROVIDER == "mistral":
            from langchain_mistralai import ChatMistralAI
            llm = ChatMistralAI(model=settings.LLM_MODEL, mistral_api_key=api_key, temperature=0.1, timeout=5.0)
        elif settings.LLM_PROVIDER == "groq":
            from langchain_groq import ChatGroq
            llm = ChatGroq(model=settings.LLM_MODEL, groq_api_key=api_key, temperature=0.1, timeout=5.0)
        else:
            from langchain_openai import ChatOpenAI
            llm = ChatOpenAI(model=settings.LLM_MODEL, openai_api_key=api_key, temperature=0.1, timeout=5.0)

        response = await llm.ainvoke(messages)
        latency = time.time() - start_time
        logger.info("LLM explanation generated successfully", provider=settings.LLM_PROVIDER, latency_sec=round(latency, 2))
        return response.content.strip()

    except Exception as e:
        latency = time.time() - start_time
        logger.warn("LLM explanation generation failed; engaging deterministic fallback", error=str(e), latency_sec=round(latency, 2))
        return fallback_text
