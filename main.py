import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import List, Any

load_dotenv()

app = FastAPI(title="Gemini Multi-Tab Chat Clone")

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

templates = Jinja2Templates(directory="templates")

app.mount("/static", StaticFiles(directory="static"), name="static")

class Message(BaseModel):
    role: str  # 'user' or 'model'
    parts: List[Any]

class ChatRequest(BaseModel):
    model: str
    stream: bool = False
    messages: List[Message]

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    # FIX: Pass request as the first argument to TemplateResponse for modern Starlette/FastAPI versions
    return templates.TemplateResponse(request, "index.html", {})

@app.post("/api/chat")
async def chat_endpoint(payload: ChatRequest):
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured in environment variables.")
    
    allowed_models = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.8-flash"]
    model_name = payload.model if payload.model in allowed_models else "gemini-3.8-flash"
    
    if not payload.messages:
        raise HTTPException(status_code=400, detail="No messages provided.")

    try:
        formatted_history = []
        for msg in payload.messages[:-1]:
            role = "user" if msg.role == "user" else "model"
            parts = []
            for p in msg.parts:
                text_val = p.get("text", str(p)) if isinstance(p, dict) else str(p)
                parts.append(types.Part.from_text(text=text_val))
            formatted_history.append(types.Content(role=role, parts=parts))
            
        if formatted_history and formatted_history[0].role != "user":
            formatted_history.pop(0)
            
        chat = (client.aio.chats if payload.stream else client.chats).create(
            model=model_name,
            history=formatted_history if formatted_history else None
        )
        
        latest_msg = payload.messages[-1]
        latest_text = ""
        for p in latest_msg.parts:
            latest_text += p.get("text", str(p)) if isinstance(p, dict) else str(p)
            
        if payload.stream:
            async def events():
                def encode(event):
                    return json.dumps(event, ensure_ascii=False) + "\n"

                try:
                    stream = await chat.send_message_stream(latest_text)
                    async for chunk in stream:
                        if chunk.text:
                            yield encode({"type": "delta", "text": chunk.text})
                    yield encode({"type": "done", "model": model_name})
                except Exception:
                    yield encode({"type": "error", "message": "Response interrupted. Please try again."})

            return StreamingResponse(
                events(),
                media_type="application/x-ndjson",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )

        response = chat.send_message(latest_text)
        reply_text = response.text if response and hasattr(response, "text") else "No response generated."
        return {"reply": reply_text, "model": model_name}
    
    except Exception as e:
        print(f"Gemini API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)