import time
from typing import Dict, Any, List, Optional
import httpx
from app.core.config import settings
from app.core.logging import logger

# Cooldown memory tracking: {f"{channel}_{recipient}_{zone_id}": last_sent_ts}
_alert_cooldowns: Dict[str, float] = {}


class Notifier:
    @staticmethod
    async def send_telegram_message(chat_id: str, message: str) -> bool:
        if not settings.TELEGRAM_BOT_TOKEN:
            logger.info("Telegram bot token not configured; simulated send", chat_id=chat_id, preview=message[:60])
            return True

        url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "HTML",
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    logger.info("Dispatched Telegram alert", chat_id=chat_id)
                    return True
                else:
                    logger.warn("Telegram alert failed", status=resp.status_code, body=resp.text)
                    return False
        except Exception as e:
            logger.warn("Telegram dispatch exception", error=str(e))
            return False

    @staticmethod
    async def send_whatsapp_message(to_number: str, message: str) -> bool:
        if not settings.WHATSAPP_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
            logger.info("WhatsApp credentials not configured; simulated send", to_number=to_number, preview=message[:60])
            return True

        url = f"https://graph.facebook.com/v19.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
        headers = {
            "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "text",
            "text": {"body": message},
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                return resp.status_code in [200, 201]
        except Exception as e:
            logger.warn("WhatsApp dispatch exception", error=str(e))
            return False

    @classmethod
    async def dispatch_forecast_alert(
        cls,
        zone_id: str,
        zone_name: str,
        depth_m: float,
        eta_hours: float,
        shelter_name: str = "Lyari Govt Relief Center",
        recipients: Optional[List[Dict[str, str]]] = None,
    ) -> int:
        """
        Dispatches multi-channel flood alerts with cooldown logic.
        Recipients reply SAFE or HELP to close the loop.
        """
        now = time.time()
        cooldown_sec = settings.ALERT_COOLDOWN_MIN * 60.0

        alert_msg = (
            f"🚨 <b>FLOOD ALERT / سیلاب کا الرٹ: {zone_name}</b>\n\n"
            f"Water expected in ~{eta_hours:.1f}h (~{depth_m:.1f}m depth).\n"
            f"پانی متوقع ہے ~{depth_m:.1f} میٹر۔\n\n"
            f"Nearest safe shelter: <b>{shelter_name}</b>\n"
            f"قریبی ریلیف کیمپ: {shelter_name}\n\n"
            f"👉 <b>Reply SAFE or HELP</b> (محفوظ یا مدد)"
        )

        sent_count = 0
        if not recipients:
            # Default demo recipients
            recipients = [
                {"channel": "telegram", "target": "demo_chat_karachi"},
                {"channel": "whatsapp", "target": "+923001234567"},
            ]

        for r in recipients:
            channel = r.get("channel", "telegram")
            target = r.get("target", "")
            key = f"{channel}_{target}_{zone_id}"

            # Anti-spam cooldown check
            if key in _alert_cooldowns:
                if now - _alert_cooldowns[key] < cooldown_sec:
                    logger.info("Alert suppressed by anti-spam cooldown", key=key)
                    continue

            success = False
            if channel == "telegram":
                success = await cls.send_telegram_message(target, alert_msg)
            elif channel == "whatsapp":
                success = await cls.send_whatsapp_message(target, alert_msg)

            if success:
                _alert_cooldowns[key] = now
                sent_count += 1

        return sent_count
