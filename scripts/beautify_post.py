#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import subprocess
import os

def beautify_telegram_post(raw_text: str) -> str:
    """
    agy -p buyrug'i orqali Telegram post matnini professional va chiroyli formatga keltiradi.
    """
    if not raw_text or not raw_text.strip():
        return raw_text

    prompt = (
        "Quyidagi Telegram post matnini o'zbek tilida professional, diqqatni tortuvchi va chiroyli formatga keltirib ber.\n\n"
        "Qat'iy qoidalar:\n"
        "1. Asosiy ma'no, raqamlar, telefonlar, username va havolalarni 100% to'liq saqlab qol.\n"
        "2. Sarlavha, punktlar va muhim joylarga mos chiroyli emojilar qo'y.\n"
        "3. Telegram HTML teglari (<b>, <i>, <code>) dan xavfsiz va chiroyli foydalan.\n"
        "4. FAQAT va FAQAT tayyor formatlangan post matnini qaytar! Hech qanday kirish so'zlari, 'mana sizga post' kabi izohlar YOZMA.\n\n"
        f"Asl matn:\n\"\"\"\n{raw_text.strip()}\n\"\"\""
    )

    try:
        # agy buyrug'ini ishga tushirish
        result = subprocess.run(
            ["agy", "-p", prompt],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=30,
            check=True
        )

        formatted_output = result.stdout.strip()
        if formatted_output:
            return formatted_output
        return raw_text

    except Exception as e:
        # Xatolik bo'lsa xavfsiz tarzda asl matnni qaytaramiz
        sys.stderr.write(f"Formatlashda xatolik: {e}\n")
        return raw_text

def main():
    # Input stdin dan yoki argumentdan olinadi
    if len(sys.argv) > 1:
        input_text = " ".join(sys.argv[1:])
    else:
        input_text = sys.stdin.read()

    beautified = beautify_telegram_post(input_text)
    print(beautified)

if __name__ == "__main__":
    main()
