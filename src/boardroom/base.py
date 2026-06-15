from __future__ import annotations 
from langchain_core.prompts import ChatPromptTemplate 
from .llm import get_llm 
from .schema import AdvisorResponse 

from typing import Optional

class BaseAdvisor: 

    name: str = 'Advisor'
    persona: str = ''
    focus: str=""


    def __init__(self, temperature: float = 0.7, retriever=None):
        if not self.persona: 
            raise ValueError(f"{type(self).__name__} must set a `persona`.")
        
        self.retriever = retriever
        
        # 200 tokens: one-line rationale + 2 tight sentences of reasoning.
        llm = get_llm(temperature=temperature, max_tokens=200)

        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are the {name} on a company's board of advisors.\n"
             "{persona}\n\n"
             "STYLE RULES — follow them strictly:\n"
             "• Write the way a seasoned board member speaks in a real meeting: "
             "direct, confident, occasionally blunt.\n"
             "• Never use filler phrases: no 'it's important to note', "
             "'it's worth considering', 'while X has merits'. Cut straight to your point.\n"
             "• Take a clear stance and defend it. Agreeing with everyone is not an option.\n"
             "• `rationale`: ONE punchy sentence — a thesis, not a hedge.\n"
             "• `reasoning`: max 3 sentences. Every word must earn its place.\n"
             "• Follow any ROUND 2 INSTRUCTIONS embedded in the context.\n\n"
             "Write your `rationale` and `reasoning` entirely in {language}."),
            ("human",
             "Business decision:\n{decision}\n\n"
             "{context}"),
        ])

        self._chain = prompt | llm.with_structured_output(AdvisorResponse)

    def search_query(self, decision: str) -> str:
        """What this advisor looks up. Defaults to the decision plus this
        advisor's `focus` keywords. Override for fully custom retrieval."""
        return f"{decision} {self.focus}".strip()
    
    def retrieve(self, decision: str) -> str:
        """Fetch company context relevant to this advisor's expertise and
        format it for the prompt. Returns a placeholder until a retriever
        is wired in by the RAG workstream."""
        if self.retriever is None:
            return "No company documents available yet."
        docs = self.retriever.invoke(self.search_query(decision))
        return "\n\n".join(d.page_content for d in docs)
    
    def analyze(
        self,
        decision: str,
        context: Optional[str] = None,
        language: str = "English",
    ) -> AdvisorResponse:
        # If the caller didn't supply context, the advisor retrieves its own.
        if context is None:
            context = self.retrieve(decision)
        result = self._chain.invoke({
            "name": self.name,
            "persona": self.persona,
            "decision": decision,
            "context": context,
            "language": language,
        })
        result.advisor = self.name
        return result