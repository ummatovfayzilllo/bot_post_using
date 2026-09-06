#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
import subprocess
import speech_recognition as sr

def transcribe_file(file_path: str) -> str:
    if not os.path.exists(file_path):
        sys.stderr.write(f"Fayl topilmadi: {file_path}\n")
        return ""

    wav_path = file_path + ".wav"

    try:
        # ffmpeg orqali .ogg/.mp3/.m4a ni 16kHz mono WAV ga o'girish
        cmd = [
            "ffmpeg",
            "-y",
            "-i", file_path,
            "-ar", "16000",
            "-ac", "1",
            wav_path
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)

        # 1. O'zbek tilida tanib ko'rish
        try:
            text = recognizer.recognize_google(audio_data, language="uz-UZ")
            if text and text.strip():
                return text.strip()
        except sr.UnknownValueError:
            pass

        # 2. Agar o'zbekchada topilmasa, rus tilida sinab ko'rish
        try:
            text = recognizer.recognize_google(audio_data, language="ru-RU")
            if text and text.strip():
                return text.strip()
        except Exception:
            pass

        return ""

    except Exception as e:
        sys.stderr.write(f"Transkripsiyada xatolik: {e}\n")
        return ""

    finally:
        # Vaqtinchalik wav faylni tozalash
        if os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except Exception:
                pass

def main():
    if len(sys.argv) < 2:
        sys.stderr.write("Foydalanish: python3 transcribe_audio.py <audio_file_path>\n")
        sys.exit(1)

    audio_path = sys.argv[1]
    result = transcribe_file(audio_path)
    print(result)

if __name__ == "__main__":
    main()
