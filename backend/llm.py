import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Generic, Optional, TypeVar

from dotenv import load_dotenv
from mistralai import Mistral
from pydantic import BaseModel, Field
from RealtimeSTT import AudioToTextRecorder

# Type variable for response format
T = TypeVar("T")


@dataclass
class Config:
    """Configuration class to manage all constants and file paths."""

    base_path: Path = Path(__file__).parent / "first-aid-prompt"
    guide_path: Path = base_path / "guide.txt"
    functions_path: Path = base_path / "functions.json"
    user_example_path: Path = base_path / "user-example.txt"

    def __post_init__(self):
        """Validate all paths exist on initialization."""
        for path_attr in ["guide_path", "functions_path", "user_example_path"]:
            path = getattr(self, path_attr)
            if not path.exists():
                raise FileNotFoundError(f"Required file not found: {path}")


class Function(BaseModel):
    """Model representing a first aid function."""

    name: str = Field(..., description="Name of the function")
    description: str = Field(..., description="Description of what the function does")
    arguments: dict[str, Any] = Field(
        ..., description="Expected arguments for the function"
    )


class LLMAssistant(Generic[T]):
    """A generic LLM assistant that can work with different response formats."""

    def __init__(
        self,
        config: Optional[Config] = None,
        client: Optional[Mistral] = None,
        system_prompt: Optional[str] = None,
    ):
        """
        Initialize the LLM Assistant.

        Args:
            config: Configuration object. If None, uses default Config
            client: Mistral client. If None, creates new client using env variables
        """
        load_dotenv()

        self.config = config or Config()
        self.client = client or self._create_client()
        self.history: list[dict[str, str]] = []
        self.system_prompt = system_prompt or self._build_system_prompt()

        # Initialize chat history with system prompt
        self.history = [{"role": "system", "content": self.system_prompt}]

    def _create_client(self) -> Mistral:
        """Create and return a new Mistral client."""
        api_key = os.getenv("MISTRAL_API_KEY")
        if not api_key:
            raise ValueError("MISTRAL_API_KEY environment variable not set")
        return Mistral(api_key=api_key)

    def _build_system_prompt(self) -> str:
        """Build the system prompt from various components."""
        try:
            with open(self.config.guide_path) as f:
                reference_guide = f.read()

            with open(self.config.functions_path) as f:
                first_aid_functions = json.load(f)["functions"]

            return "\n\n".join(
                [
                    f"Use the following reference guide to complete the task:\n{reference_guide}",
                    f"I have a list of first aid functions, each with a description and expected arguments. "
                    f"Based on a user's input, I want to choose the appropriate function to call. "
                    f"The list of available functions is as follows:\n{first_aid_functions}",
                    "You should systematically ask for more context information if the user's input is "
                    "ambiguous or incomplete. Don't take any risk with first aid.",
                ]
            )
        except Exception as e:
            raise RuntimeError(f"Failed to build system prompt: {str(e)}")

    def chat(
        self,
        prompt: str,
        *,
        model: str = "mistral-small-latest",
        response_format: type[T] = Function,
        max_tokens: int = 100000,
        temperature: float = 0.0,
    ) -> T:
        """
        Send a chat message and get a response.

        Args:
            prompt: User's input message
            model: Model identifier to use
            response_format: Expected response format (must be Pydantic model)
            max_tokens: Maximum tokens in response
            temperature: Temperature for response generation

        Returns:
            Parsed response in specified format

        Raises:
            ValueError: If prompt is empty
            RuntimeError: If API call fails
        """
        if not prompt.strip():
            raise ValueError("Prompt cannot be empty")

        try:
            self.history.append({"role": "user", "content": prompt})

            response = self.client.chat.parse(
                model=model,
                messages=self.history,
                response_format=response_format,
                max_tokens=max_tokens,
                temperature=temperature,
            )

            result = response.choices[0].message.content
            self.history.append({"role": "assistant", "content": str(result)})

            return result

        except Exception as e:
            raise RuntimeError(f"Chat completion failed: {str(e)}")


if __name__ == "__main__":
    recorder_config = {
        # "spinner": False,
        # "use_microphone": False,
        "model": "small",
        "language": "fr",
        "silero_sensitivity": 0.4,
        "webrtc_sensitivity": 2,
        "post_speech_silence_duration": 0.2,
        "min_length_of_recording": 0,
        "min_gap_between_recordings": 0,
        "enable_realtime_transcription": True,
        "realtime_processing_pause": 0,
        "realtime_model_type": "tiny",
    }

    recorder = AudioToTextRecorder(**recorder_config)
    llm = LLMAssistant()

    while True:
        recorder.text(llm.chat)
