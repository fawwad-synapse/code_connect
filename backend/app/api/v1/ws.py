import json
from typing import List, Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.logging import logger

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket client connected", total_clients=len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info("WebSocket client disconnected", total_clients=len(self.active_connections))

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        payload = json.dumps({"type": event_type, "data": data})
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.warn("WebSocket send failed", error=str(e))
                disconnected.append(connection)

        for dead in disconnected:
            self.disconnect(dead)


ws_manager = ConnectionManager()


@router.websocket("/events")
async def websocket_events(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep-alive ping/pong
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warn("WebSocket exception", error=str(e))
        ws_manager.disconnect(websocket)
