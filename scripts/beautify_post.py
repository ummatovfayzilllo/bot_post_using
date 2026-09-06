#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import subprocess
import os

def beautify_telegram_post(raw_text: str) -> str:
    """
    agy -p buyrug'i orqali Telegram post matnini xavfsiz va chiroyli formatga keltiradi.
    """
    if not raw_text or not raw_text.strip():
        return raw_text

    prompt = (
        "Sen professional Telegram SMM mutaxassisissan. Quyidagi xom matnni Telegram post uchun juda chiroyli, o'qishli, strukturali va diqqatni tortuvchi formatga keltirib ber.\n\n"
        "QAT'IY QOIDALAR:\n"
        "1. XAVFSIZ HTML FORMAT: Faqat Telegram qo'llab-quvvatlaydigan to'g'ri yopilgan HTML teglaridan foydalan (<b>, </b>, <i>, </i>, <code>, </code>). Hech qachon noto'g'ri yopilmagan yoki <, > belgilarini o'z holicha qoldirma!\n"
        "2. ASOSIY MA'LUMOTLARNI SAQLASH: Barcha telefon raqamlar, narxlar, ismlar, @username va havolalar 100% o'zgarmasdan saqlanishi shart.\n"
        "3. EMOJILAR VA STRUKTURA: Sarlavha, muhim parametrlar va kontaktlar uchun mos, chiroyli emojilar qo'y.\n"
        "4. FAQAT NATIJA: Faqat tayyor formatlangan post matnini qaytar! Hech qanday salomlashish, kirish so'zlari yoki ortiqcha tushuntirish yozma.\n\n"
        f"Asl matn:\n\"\"\"\n{raw_text.strip()}\n\"\"\""
    )

    try:
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
        sys.stderr.write(f"Formatlashda xatolik: {e}\n")
        return raw_text

def main():
    if len(sys.argv) > 1:
        input_text = " ".join(sys.argv[1:])
    else:
        input_text = sys.stdin.read()

    beautified = beautify_telegram_post(input_text)
    print(beautified)

if __name__ == "__main__":
    main()
