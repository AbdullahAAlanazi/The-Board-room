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
        
        # Kept tight for speed: a short perspective + a few brief items + 2 sentences.
        llm = get_llm(temperature=temperature, max_tokens=200)

        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are the {name} on a company's board of advisors.\n"
             "{persona}\n\n"
             "HOW YOU CONTRIBUTE — this is a collaborative panel, not a debate to win. "
             "Be brief; this is spoken at a fast-moving meeting:\n"
             "• `perspective`: ONE sentence — your honest view through your lens. A "
             "viewpoint, not a vote.\n"
             "• `conditions`: at most 3, each a short phrase — what must be true for this "
             "to work. Anything that merely NEEDS to be arranged (a license, a permit, a "
             "hire, a budget line) is a CONDITION, never a reason to oppose.\n"
             "• `recommendations`: at most 2 short, concrete suggestions.\n"
             "• `reasoning`: 2 sentences maximum.\n"
             "• Engage genuinely with the others. Do NOT manufacture disagreement, and do "
             "NOT restate what someone already said.\n"
             "• If this decision genuinely falls OUTSIDE your domain, set `relevant` to "
             "false and let `perspective` be one short line saying so — leave conditions "
             "and recommendations empty. Never force an opinion just to have one.\n"
             "• No filler ('it's important to note', 'while X has merits'). Be direct.\n"
             "• Follow any ROUND 2 INSTRUCTIONS embedded in the context.\n\n"
             "Write `perspective`, `conditions`, `recommendations`, and `reasoning` "
             "entirely in {language}."),
            ("human",
             "Business decision:\n{decision}\n\n"
             "{context}"),
        ])

        self._chain = prompt | llm.with_structured_output(AdvisorResponse)

    def ask_question(self, decision: str, language: str = "English") -> str:
        """Generate one clarifying question from this advisor's perspective."""
        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are the {name} on a company's board of advisors.\n{persona}\n\n"
             "A business decision has been brought to the board. Ask ONE focused clarifying "
             "question — the single most important thing YOU need to know that the decision "
             "statement doesn't already answer. One sentence, no preamble. "
             "Write entirely in {language}."),
            ("human", "Business decision: {decision}"),
        ])
        llm = get_llm(temperature=0.4, max_tokens=80)
        result = (prompt | llm).invoke({
            "name": self.name,
            "persona": self.persona,
            "decision": decision,
            "language": language,
        })
        return result.content.strip()

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