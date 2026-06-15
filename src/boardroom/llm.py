from __future__ import annotations

from typing import Optional

from langchain_openai import ChatOpenAI

from .config import settings

def get_llm(temperature: float=0.7, model: Optional[str] = None) -> ChatOpenAI:
    return ChatOpenAI(
        model=model or settings.openai_model, 
        temperature=temperature, 
        api_key=settings.openai_api_key or None,
    ) 
