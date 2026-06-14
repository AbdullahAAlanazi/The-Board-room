from __future__ import annotations 
from langchain_core.prompts import ChatPromptTemplate 
from .llm import get_llm 
from .schema import AdvisorResponse 

class BaseAdvisor: 

    name: str = 'Advisor'
    persona: str = ''


    def __init__(self, temperature: float = 0.7):
        if not self.persona: 
            raise ValueError(f"{type(self).__name__} must set a `persona`.")
        
        llm = get_llm(temperature=temperature)

        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are the {name} on a company's board of advisors.\n"
             "{persona}\n\n"
             "Analyze the decision strictly through your lens. Take a clear "
             "stance and defend it; disagreeing with other advisors is good — "
             "the board's value comes from genuine tension."),
            ("human",
             "Business decision:\n{decision}\n\n"
             "Company context:\n{context}"),
        ])

        self._chain = prompt | llm.with_structured_output(AdvisorResponse)

    def analyze(self, decision: str, context: str = "") -> AdvisorResponse:
        result = self._chain.invoke({
            "name": self.name,
            "persona": self.persona,
            "decision": decision,
            "context": context or "No additional company context provided.",
        })
        result.advisor = self.name  # guarantee the right label
        return result