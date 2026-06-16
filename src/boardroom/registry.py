
from __future__ import annotations

from typing import List, Type

from .base import BaseAdvisor


_ADVISORS: List[Type[BaseAdvisor]] =  []

def register(advisor_cls: Type[BaseAdvisor]) -> Type[BaseAdvisor]:
    _ADVISORS.append(advisor_cls)
    return advisor_cls

def registered_classes() -> List[Type[BaseAdvisor]]:
    return list(_ADVISORS)

def get_advisors(retriever=None) -> List[BaseAdvisor]:
    return [cls(retriever=retriever) for cls in _ADVISORS]
