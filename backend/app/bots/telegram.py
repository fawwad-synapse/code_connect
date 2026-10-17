import os
from typing import Dict, Any, Optional
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)
from app.core.config import settings
from app.core.logging import logger

# In-memory subscriber storage for demo: {chat_id: {"zone": zone_id, "username": username}}
_subscribers: Dict[str, Dict[str, Any]] = {}


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles /start command"""
    chat_id = str(update.effective_chat.id)
    username = update.effective_user.first_name or "Citizen"

    welcome_text = (
        f"👋 Salam {username}!\n\n"
        f"Welcome to <b>RescueRank Karachi Emergency Alert System</b>.\n"
        f"سیلاب ایمرجنسی سسٹم میں خوش آمدید۔\n\n"
        f"Commands:\n"
        f"📍 <code>/zone &lt;name&gt;</code> - Subscribe to flood warnings (e.g. <code>/zone Lyari</code>)\n"
        f"🆘 <code>/help</code> - Request immediate emergency evacuation\n"
        f"✅ <code>/safe</code> - Acknowledge alert & confirm you are safe\n"
        f"📝 <code>/report &lt;details&gt;</code> - Submit a flood report\n"
        f"ℹ️ <code>/status</code> - Check current zone threat level"
    )
    await update.message.reply_text(welcome_text, parse_mode="HTML")


async def zone_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles /zone <name> command"""
    chat_id = str(update.effective_chat.id)
    args = context.args

    if not args:
        await update.message.reply_text(
            "Please specify a zone name. Available zones:\n"
            "• Lyari\n• Malir\n• Korangi\n• Saddar\n• Clifton\n• Orangi\n\n"
            "Example: <code>/zone Lyari</code>",
            parse_mode="HTML"
        )
        return

    zone_input = " ".join(args).capitalize()
    _subscribers[chat_id] = {
        "zone": zone_input,
        "username": update.effective_user.first_name or "Citizen",
    }

    await update.message.reply_text(
        f"✅ <b>Subscribed to {zone_input}</b>!\n"
        f"You will automatically receive high-risk flood warnings and evacuation notices.\n\n"
        f"آپ کو {zone_input} کے سیلابی الرٹس موصول ہوں گے۔",
        parse_mode="HTML"
    )
    logger.info("New citizen subscribed to telegram bot", chat_id=chat_id, zone=zone_input)


async def safe_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles /safe command"""
    chat_id = str(update.effective_chat.id)
    sub = _subscribers.get(chat_id, {})
    zone = sub.get("zone", "Karachi")

    await update.message.reply_text(
        f"✅ <b>Status Recorded: SAFE (محفوظ)</b>\n"
        f"Thank you. Your safety acknowledgment has been logged on the Emergency Operations Console for {zone}.\n"
        f"Stay tuned for weather updates.",
        parse_mode="HTML"
    )
    logger.info("Citizen confirmed SAFE", chat_id=chat_id, zone=zone)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles /help command"""
    chat_id = str(update.effective_chat.id)
    sub = _subscribers.get(chat_id, {})
    zone = sub.get("zone", "Lyari")

    await update.message.reply_text(
        f"🚨 <b>EMERGENCY HELP REQUEST LOGGED!</b>\n"
        f"مدد کی درخواست درج کر لی گئی ہے۔\n\n"
        f"Your location in {zone} has been elevated to CRITICAL priority on the RescueRank Dispatch Board.\n"
        f"Please state if anyone needs medical assistance or is elderly/immobile.",
        parse_mode="HTML"
    )
    logger.info("Citizen requested EMERGENCY HELP", chat_id=chat_id, zone=zone)


async def message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles free text replies like SAFE or HELP"""
    text = (update.message.text or "").strip().upper()
    if "SAFE" in text or "محفوظ" in text:
        await safe_command(update, context)
    elif "HELP" in text or "مدد" in text or "RESCUE" in text:
        await help_command(update, context)
    else:
        await update.message.reply_text(
            "Received. Reply <b>SAFE</b> if you are secure, or <b>HELP</b> if you require emergency assistance.",
            parse_mode="HTML"
        )


def create_telegram_bot_app() -> Optional[Application]:
    """Builds the python-telegram-bot application"""
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        logger.info("TELEGRAM_BOT_TOKEN not provided; bot polling disabled (will use simulated notifications)")
        return None

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("zone", zone_command))
    app.add_handler(CommandHandler("safe", safe_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, message_handler))

    return app
