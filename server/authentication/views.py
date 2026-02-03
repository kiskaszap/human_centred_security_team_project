from django.shortcuts import render

# Create your views here.
import random
from django.http import JsonResponse
from django.contrib.auth import authenticate, login
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_exempt
from .models import Song, UserPlaylist

REQUIRED_CORRECT = 3
TOTAL_ROUNDS = 5


@ensure_csrf_cookie
def csrf(request):
    return JsonResponse({"detail": "CSRF cookie set"})


@require_POST
def login_view(request):
    username = request.POST.get("username")
    password = request.POST.get("password")

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"error": "Invalid credentials"}, status=401)

    login(request, user)
    return JsonResponse({"status": "logged_in"})


@csrf_exempt
@require_POST
def start_2fa(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Auth required"}, status=401)

    request.session["2fa"] = {
        "round": 0,
        "correct": 0,
        "used_song_ids": [],
    }
    return JsonResponse({"status": "started"})


def get_challenge(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Auth required"}, status=401)

    state = request.session.get("2fa")
    if not state:
        return JsonResponse({"error": "2FA not started"}, status=400)

    user_songs = Song.objects.filter(
        userplaylist__user=request.user
    ).exclude(id__in=state["used_song_ids"])

    if not user_songs.exists():
        return JsonResponse({"error": "No songs available"}, status=400)

    correct_song = random.choice(list(user_songs))
    state["used_song_ids"].append(correct_song.id)

    options = list(Song.objects.order_by("?")[:4])
    if correct_song not in options:
        options[random.randint(0, 3)] = correct_song

    random.shuffle(options)

    state["round"] += 1
    request.session["2fa"] = state

    return JsonResponse({
        "round": state["round"],
        "audio_url": correct_song.audio_file.url,
        "options": [{"id": s.id, "title": s.title} for s in options],
    })


@csrf_exempt
@require_POST
def submit_answer(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Auth required"}, status=401)

    state = request.session.get("2fa")
    selected_id = int(request.POST.get("song_id"))

    if selected_id == state["used_song_ids"][-1]:
        state["correct"] += 1

    success = state["correct"] >= REQUIRED_CORRECT
    finished = success or state["round"] >= TOTAL_ROUNDS

    request.session["2fa"] = state

    return JsonResponse({
        "correct": state["correct"],
        "finished": finished,
        "success": success,
    })
